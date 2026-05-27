import { describe, it, expect } from "vitest";
import { detectRegexMisuse, detectLanguageSpecificMistake } from "../pattern-hints.js";

describe("detectRegexMisuse", () => {
  it("detects \\w escape", () => {
    expect(detectRegexMisuse("\\w+")).not.toBeNull();
  });

  it("detects character class [a-z]", () => {
    expect(detectRegexMisuse("[a-z]")).not.toBeNull();
  });

  it("detects .* wildcard", () => {
    expect(detectRegexMisuse("foo.*bar")).not.toBeNull();
  });

  it("detects | alternation", () => {
    expect(detectRegexMisuse("foo|bar")).not.toBeNull();
  });

  it("returns null for valid ast-grep pattern", () => {
    expect(detectRegexMisuse("console.log($$$)")).toBeNull();
  });
});

describe("detectLanguageSpecificMistake", () => {
  it("detects Python trailing colon in class", () => {
    expect(detectLanguageSpecificMistake("class Foo:", "python")).not.toBeNull();
  });

  it("detects Python trailing colon in def", () => {
    expect(detectLanguageSpecificMistake("def foo():", "python")).not.toBeNull();
  });

  it("detects JS function without body", () => {
    expect(detectLanguageSpecificMistake("function $NAME", "javascript")).not.toBeNull();
  });

  it("detects Go func without body", () => {
    expect(detectLanguageSpecificMistake("func $NAME", "go")).not.toBeNull();
  });

  it("detects Rust fn without body", () => {
    expect(detectLanguageSpecificMistake("fn $NAME", "rust")).not.toBeNull();
  });

  it("detects C# class without body", () => {
    expect(detectLanguageSpecificMistake("class $NAME", "csharp")).not.toBeNull();
  });

  it("returns null for valid pattern", () => {
    expect(detectLanguageSpecificMistake("function $NAME($$$) { $$$ }", "javascript")).toBeNull();
  });
});
