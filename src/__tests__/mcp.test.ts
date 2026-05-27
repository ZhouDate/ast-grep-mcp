import { describe, it, expect } from "vitest";
import { handleAstGrepMcpRequest } from "../mcp.js";

describe("handleAstGrepMcpRequest", () => {
  it("returns -32600 for non-object input", async () => {
    const res = await handleAstGrepMcpRequest("not an object");
    expect(res).toEqual({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid Request" } });
  });

  it("handles initialize", async () => {
    const res = await handleAstGrepMcpRequest({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05" } });
    expect(res?.result?.serverInfo?.name).toBe("ast_grep");
    expect(res?.result?.protocolVersion).toBe("2024-11-05");
  });

  it("handles ping", async () => {
    const res = await handleAstGrepMcpRequest({ jsonrpc: "2.0", id: 2, method: "ping" });
    expect(res?.id).toBe(2);
    expect(res?.result).toEqual({});
  });

  it("returns undefined for notifications/initialized", async () => {
    const res = await handleAstGrepMcpRequest({ jsonrpc: "2.0", method: "notifications/initialized" });
    expect(res).toBeUndefined();
  });

  it("handles tools/list", async () => {
    const res = await handleAstGrepMcpRequest({ jsonrpc: "2.0", id: 3, method: "tools/list", params: {} });
    const tools = res?.result?.tools as unknown as Array<{ name: string }>;
    expect(tools.map((t) => t.name).sort()).toEqual(["replace", "search"]);
  });

  it("respects disabledTools option", async () => {
    const res = await handleAstGrepMcpRequest({ jsonrpc: "2.0", id: 4, method: "tools/list", params: {} }, { disabledTools: ["search"] });
    const tools = res?.result?.tools as unknown as Array<{ name: string }>;
    expect(tools.map((t) => t.name)).toEqual(["replace"]);
  });

  it("returns -32601 for unknown method", async () => {
    const res = await handleAstGrepMcpRequest({ jsonrpc: "2.0", id: 5, method: "unknown" });
    expect(res?.error?.code).toBe(-32601);
  });

  it("handles tools/call search with mock", async () => {
    const mockRunSg = async () => ({
      matches: [{ text: "console.log('hello')", range: { byteOffset: { start: 0, end: 24 }, start: { line: 1, column: 0 }, end: { line: 1, column: 24 } }, file: "test.js", lines: "console.log('hello')", charCount: { leading: 0, trailing: 0 }, language: "javascript" }],
      totalMatches: 1,
      truncated: false,
    });
    const res = await handleAstGrepMcpRequest(
      { jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "search", arguments: { pattern: "console.log($$$)", lang: "javascript" } } },
      { runSg: mockRunSg, workspaceDirectory: process.cwd() },
    );
    expect(res?.result?.isError).toBe(false);
    expect(res?.id).toBe(6);
  });

  it("returns error for tools/call without name", async () => {
    const res = await handleAstGrepMcpRequest({ jsonrpc: "2.0", id: 7, method: "tools/call", params: {} });
    expect(res?.error?.code).toBe(-32602);
  });

  it("returns error for disabled tool call", async () => {
    const res = await handleAstGrepMcpRequest(
      { jsonrpc: "2.0", id: 8, method: "tools/call", params: { name: "search", arguments: { pattern: "x", lang: "javascript" } } },
      { disabledTools: ["search"] },
    );
    expect(res?.result?.isError).toBe(true);
  });
});
