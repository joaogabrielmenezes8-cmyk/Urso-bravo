// Local integration against a throwaway Postgres started by
// supabase/tests/notice_legal_integration.sh. Skipped in the normal suite.
import { execFileSync } from "node:child_process";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const HOST = process.env["NOTICE_IT_PGHOST"];
const PORT = process.env["NOTICE_IT_PGPORT"];
const STUDENT = "70000000-0000-0000-0000-000000000001";
const PROVISION = "20000000-0000-0000-0000-000000000001";
const OFFICIAL = "80000000-0000-0000-0000-000000000001";
const ORIGINAL = "80000000-0000-0000-0000-000000000002";
const NO_REFS = "80000000-0000-0000-0000-000000000003";
const PINNED_MOCK = "90000000-0000-0000-0000-000000000003";

const session = vi.hoisted(() => ({ premium: "yes" }));
function sql(query: string): unknown {
  const prelude = `set role authenticated; set test.uid='${STUDENT}'; set test.premium='${session.premium}';`;
  const out = execFileSync("psql", ["-X", "-q", "-At", "-h", HOST!, "-p", PORT!, "-U", "postgres", "-d", "postgres",
    "-v", "ON_ERROR_STOP=1", "-c", prelude, "-c", query], { encoding: "utf8" });
  return JSON.parse(out.trim().split("\n").pop() || "null");
}
const lit = (v: unknown) => (v == null ? "null" : `'${String(v).replace(/'/g, "''")}'`);
function rpc(name: string, args: Record<string, unknown> = {}) {
  try {
    const named = Object.entries(args).map(([k, v]) => `${k} => ${lit(v)}`).join(", ");
    const setReturning = sql(`select to_jsonb(proretset) from pg_proc where proname = '${name}'`) === true;
    const rows = setReturning
      ? sql(`select coalesce(jsonb_agg(to_jsonb(r)), '[]') from public.${name}(${named}) r`)
      : sql(`select to_jsonb(public.${name}(${named}))`);
    return { data: rows, error: null };
  } catch (error) { if (process.env["NOTICE_IT_DEBUG"]) console.error("RPC", name, String((error as {stderr?: string}).stderr ?? error)); return { data: null, error }; }
}
vi.mock("@/lib/supabase", () => ({
  untypedSupabase: {
    rpc: async (name: string, args?: Record<string, unknown>) => rpc(name, args),
  },
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ user: { id: STUDENT } }) }));
vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children: unknown }) => children }));
// AI stub: no real provider call, no cost.
const ai = vi.hoisted(() => ({ calls: [] as string[] }));
vi.mock("@ai-sdk/openai", () => ({ createOpenAI: () => ({ responses: () => "stub-model" }) }));
vi.mock("ai", () => ({ streamText: (opts: { system: string }) => { ai.calls.push(opts.system); return { text: Promise.resolve("Resposta do tutor (stub).") }; } }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => { const b = { inputValidator: () => b, handler: (fn: unknown) => fn }; return b; },
}));

const run = HOST && PORT ? describe : describe.skip;
function wrap(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

run("Vade Mecum temporal — integração local com banco descartável", () => {
  it("leitor: Atual, Edital e Comparar com dados resolvidos pelo banco", async () => {
    const { NoticeLegalReading } = await import("@/components/app/notice-legal-reading");
    const { useState } = await import("react");
    function Harness({ initialNotice = "" }: { initialNotice?: string }) {
      const [mode, setMode] = useState<"current" | "notice" | "compare">(initialNotice ? "notice" : "current");
      const [noticeId, setNoticeId] = useState(initialNotice);
      return <NoticeLegalReading noticeId={noticeId} setNoticeId={setNoticeId} revisionId={undefined} mode={mode}
        setMode={setMode} provisionId={PROVISION} currentBody="Texto posterior" fontSize={16} userId={STUDENT} />;
    }
    const modeOf = (c: HTMLElement) => c.querySelector("select")!;
    // Premium: edital ativo e histórico selado aparecem na lista.
    const a = wrap(<Harness />);
    expect(a.container.textContent).not.toContain("Texto anterior");
    fireEvent.change(modeOf(a.container), { target: { value: "notice" } });
    await waitFor(() => expect(a.getByText("CFO 2027 (sintético)")).toBeTruthy());
    expect(a.getByText("CFO 2025 (sintético)")).toBeTruthy();
    fireEvent.change(a.getByRole("combobox", { name: /Edital/ }), { target: { value: "10000000-0000-0000-0000-000000000002" } });
    expect(await a.findByText("Texto posterior")).toBeTruthy();
    expect(a.getByText("Data de corte do edital: 03/09/2026")).toBeTruthy();
    fireEvent.change(modeOf(a.container), { target: { value: "compare" } });
    expect(await a.findByText("As redações exibidas são iguais.")).toBeTruthy();
    a.unmount();
    // Edital histórico aberto por link da questão (edital=...): redação antiga e comparação.
    const b = wrap(<Harness initialNotice="10000000-0000-0000-0000-000000000001" />);
    expect(await b.findByText("Texto anterior")).toBeTruthy();
    expect(b.getByText("Data de corte do edital: 09/05/2024")).toBeTruthy();
    fireEvent.change(modeOf(b.container), { target: { value: "compare" } });
    expect(await b.findByText("O texto atual difere da redação do edital.")).toBeTruthy();
  });

  it("lista do leitor: premium vê edital histórico selado e o seleciona; grátis vê só o ativo", async () => {
    const { NoticeLegalReading } = await import("@/components/app/notice-legal-reading");
    const view = () => wrap(<NoticeLegalReading noticeId="" setNoticeId={() => {}} revisionId={undefined} mode="notice"
      setMode={() => {}} provisionId={PROVISION} currentBody="Texto posterior" fontSize={16} userId={STUDENT} />);
    session.premium = "no";
    const free = view();
    await waitFor(() => expect(free.getByText("CFO 2027 (sintético)")).toBeTruthy());
    expect(free.queryByText("CFO 2025 (sintético)")).toBeNull();
    free.unmount();
    session.premium = "yes";
    const { useState } = await import("react");
    function Harness() {
      const [noticeId, setNoticeId] = useState("");
      return <NoticeLegalReading noticeId={noticeId} setNoticeId={setNoticeId} revisionId={undefined} mode="notice"
        setMode={() => {}} provisionId={PROVISION} currentBody="Texto posterior" fontSize={16} userId={STUDENT} />;
    }
    const premium = wrap(<Harness />);
    await waitFor(() => expect(premium.getByText("CFO 2025 (sintético)")).toBeTruthy());
    fireEvent.change(premium.getByRole("combobox", { name: /Edital/ }), { target: { value: "10000000-0000-0000-0000-000000000001" } });
    expect(await premium.findByText("Texto anterior")).toBeTruthy();
  });

  it("comentário editorial aparece rotulado e separado do texto legal resolvido", async () => {
    const { EditorialCommentary } = await import("@/components/app/editorial-commentary");
    const pending = wrap(<EditorialCommentary questionId={NO_REFS} explanation="COMENTARIO_EDITORIAL" legalBasis="Art. 1" />);
    await waitFor(() => expect(pending.getByText("COMENTARIO_EDITORIAL")).toBeTruthy());
    await waitFor(() => expect(pending.container.textContent).toContain("Contexto temporal ainda não certificado"));
    expect(pending.container.textContent).not.toContain("Texto anterior");
    pending.unmount();
    const certified = wrap(<EditorialCommentary questionId={OFFICIAL} explanation="COMENTARIO_EDITORIAL" legalBasis={null} />);
    await waitFor(() => expect(certified.getByText("COMENTARIO_EDITORIAL")).toBeTruthy());
    await new Promise((r) => setTimeout(r, 200));
    expect(certified.container.textContent).not.toContain("ainda não certificado");
    expect(certified.container.textContent).not.toContain("Texto anterior");
  });

  it("questão oficial usa a edição original; simulado usa a revisão fixada", async () => {
    const { QuestionNoticeReading } = await import("@/components/app/question-notice-reading");
    const a = wrap(<QuestionNoticeReading questionId={OFFICIAL} />);
    expect(await a.findByText("Data de corte: 09/05/2024")).toBeTruthy();
    expect(a.container.textContent).toContain("Texto anterior");
    a.unmount();
    const b = wrap(<QuestionNoticeReading questionId={ORIGINAL} attemptId={PINNED_MOCK} />);
    expect(await b.findByText("Data de corte: 03/09/2026")).toBeTruthy();
    expect(b.container.textContent).toContain("Texto posterior");
  });

  it("tutor bloqueia sem referências e responde com IA stub quando há redação certificada", async () => {
    process.env["LOVABLE_API_KEY"] = "stub-key";
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      if (url.includes("/auth/v1/user")) return new Response("{}", { status: 200 });
      if (url.includes("/rest/v1/questions")) return new Response(JSON.stringify([{ statement: "Enunciado", origin: "official",
        official_answer_key: "A", explanation: "COMENTARIO_EDITORIAL", legal_basis: "BASE_EDITORIAL",
        question_options: [{ label: "A", content: "x", is_currently_correct: false, sort_order: 1 }, { label: "B", content: "y", is_currently_correct: true, sort_order: 2 }] }]), { status: 200 });
      if (url.includes("/rpc/resolve_question_notice_legal_context")) {
        const body = JSON.parse(String(init?.body));
        const res = rpc("resolve_question_notice_legal_context", body);
        return new Response(JSON.stringify(res.data), { status: res.error ? 400 : 200 });
      }
      throw new Error("unexpected network call " + url);
    }) as typeof fetch;
    try {
      const { askQuestionTutor } = await import("@/lib/question-tutor.functions");
      const call = askQuestionTutor as unknown as (a: { data: unknown }) => Promise<{ ok: boolean; error?: string; answer?: string }>;
      const base = { accessToken: "synthetic-token", level: "iniciante", message: "Explique", history: [],
        revisionId: "30000000-0000-0000-0000-000000000001" };
      const blocked = await call({ data: { ...base, questionId: NO_REFS } });
      expect(blocked).toEqual({ ok: false, error: "Fundamentação legislativa do edital pendente de certificação." });
      expect(ai.calls).toHaveLength(0);
      const ok = await call({ data: { ...base, questionId: OFFICIAL } });
      expect(ok.ok).toBe(true);
      expect(ai.calls[0]).toContain("Texto anterior");
      expect(ai.calls[0]).toContain("Data de corte: 2024-05-09");
      expect(ai.calls[0]).toContain("GABARITO: A"); // gabarito oficial preservado
      expect(ai.calls[0]).not.toContain("COMENTARIO_EDITORIAL");
      expect(ai.calls[0]).not.toContain("BASE_EDITORIAL");
    } finally { globalThis.fetch = realFetch; }
  });

  it("conta sem premium não recebe texto histórico", async () => {
    session.premium = "no";
    const res = rpc("resolve_question_notice_legal_context", { p_question_id: OFFICIAL });
    expect(JSON.stringify(res.data)).not.toContain("Texto anterior");
    session.premium = "yes";
  });
});
