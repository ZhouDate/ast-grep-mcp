import { existsSync } from "node:fs"
import { DEFAULT_TIMEOUT_MS } from "./language-support.js"
import { createSgResultFromStdout } from "./sg-compact-json-output.js"
import type { CliLanguage, SgResult } from "./types.js"
import { spawn } from "./bun-spawn-shim.js"
import {
	ensureCliAvailable,
	getAstGrepPath,
	isCliAvailable,
	startBackgroundInit,
} from "./cli-binary-path-resolution.js"
import { getSgCliPath } from "./constants.js"
import { collectProcessOutputWithTimeout } from "./process-output-timeout.js"

export { ensureCliAvailable, getAstGrepPath, isCliAvailable, startBackgroundInit }

const SG_BINARY_NOT_FOUND_MESSAGE =
	`ast-grep (sg) binary not found.\n\n` +
	`Install options:\n` +
	`  npm install -D @ast-grep/cli\n` +
	`  cargo install ast-grep --locked\n` +
	`  brew install ast-grep`

export interface SgRunArgs {
	readonly pattern: string
	readonly lang: CliLanguage
	readonly cwd?: string
	readonly paths?: readonly string[]
	readonly globs?: readonly string[]
	readonly rewrite?: string
	readonly context?: number
	readonly updateAll?: boolean
}

export type RunOptions = SgRunArgs

interface SpawnOptions {
	readonly cwd?: string
	readonly stdout?: "pipe" | "inherit" | "ignore"
	readonly stderr?: "pipe" | "inherit" | "ignore"
}

interface SpawnResult {
	readonly stdout: string
	readonly stderr: string
	readonly exitCode: number
}

export async function runSg(options: RunOptions): Promise<SgResult> {
	const shouldSeparateWritePass = Boolean(options.rewrite && options.updateAll)
	const args = buildSgArgs(options, { includeJson: true, includeUpdateAll: false })

	let binary: string
	try {
		binary = await resolveBinaryPath()
	} catch (error) {
		return {
			matches: [],
			totalMatches: 0,
			truncated: false,
			error: isNoEntryError(error) ? SG_BINARY_NOT_FOUND_MESSAGE : `Failed to resolve ast-grep binary: ${errorMessage(error)}`,
		}
	}

	const searchResult = await trySpawn(binary, args, options.cwd)
	if (!searchResult.ok) {
		return searchResult.error
	}

	const output = searchResult.value
	if (output.exitCode !== 0 && output.stdout.trim() === "") {
		if (output.stderr.includes("No files found")) {
			return { matches: [], totalMatches: 0, truncated: false }
		}
		if (output.stderr.trim()) {
			return { matches: [], totalMatches: 0, truncated: false, error: output.stderr.trim() }
		}
		return { matches: [], totalMatches: 0, truncated: false }
	}

	const jsonResult = createSgResultFromStdout(output.stdout)
	if (!(shouldSeparateWritePass && jsonResult.matches.length > 0)) {
		return jsonResult
	}

	const writeArgs = buildSgArgs(options, { includeJson: false, includeUpdateAll: true })
	const writeResult = await trySpawn(binary, writeArgs, options.cwd)
	if (!writeResult.ok) {
		return { ...jsonResult, error: `Replace failed: ${writeResult.error.error ?? "unknown error"}` }
	}

	if (writeResult.value.exitCode !== 0) {
		const errorDetail =
			writeResult.value.stderr.trim() || `ast-grep exited with code ${writeResult.value.exitCode}`
		return { ...jsonResult, error: `Replace failed: ${errorDetail}` }
	}

	return jsonResult
}

function buildSgArgs(
	options: SgRunArgs,
	flags: { readonly includeJson: boolean; readonly includeUpdateAll: boolean },
): string[] {
	const args = ["run", "-p", options.pattern, "--lang", options.lang]

	if (flags.includeJson) {
		args.push("--json=compact")
	}

	if (options.rewrite) {
		args.push("-r", options.rewrite)
		if (flags.includeUpdateAll) {
			args.push("--update-all")
		}
	}

	if (typeof options.context === "number" && options.context > 0) {
		args.push("-C", String(options.context))
	}

	if (options.globs) {
		for (const glob of options.globs) {
			args.push("--globs", glob)
		}
	}

	const paths = options.paths && options.paths.length > 0 ? options.paths : ["."]
	args.push("--", ...paths)
	return args
}

async function resolveBinaryPath(): Promise<string> {
	const cliPath = getSgCliPath()
	if (cliPath && existsSync(cliPath)) {
		return cliPath
	}

	const resolvedPath = await getAstGrepPath()
	if (!resolvedPath) {
		const noEntryError = new Error("ENOENT: ast-grep binary not found")
		Reflect.set(noEntryError, "code", "ENOENT")
		throw noEntryError
	}
	return resolvedPath
}

async function spawnProcess(
	binary: string,
	args: readonly string[],
	options?: SpawnOptions,
): Promise<SpawnResult> {
	const proc = spawn([binary, ...args], {
		cwd: options?.cwd,
		stdout: options?.stdout ?? "pipe",
		stderr: options?.stderr ?? "pipe",
	})

	return collectProcessOutputWithTimeout(proc, DEFAULT_TIMEOUT_MS)
}

async function trySpawn(
	binary: string,
	args: readonly string[],
	cwd: string | undefined,
): Promise<{ readonly ok: true; readonly value: SpawnResult } | { readonly ok: false; readonly error: SgResult }> {
	try {
		const value = await spawnProcess(binary, args, {
			cwd,
			stdout: "pipe",
			stderr: "pipe",
		})
		return { ok: true, value }
	} catch (error) {
		if (error instanceof Error && error.message.includes("timeout")) {
			return {
				ok: false,
				error: {
					matches: [],
					totalMatches: 0,
					truncated: true,
					truncatedReason: "timeout",
					error: error.message,
				},
			}
		}

		if (isNoEntryError(error)) {
			return {
				ok: false,
				error: {
					matches: [],
					totalMatches: 0,
					truncated: false,
					error: SG_BINARY_NOT_FOUND_MESSAGE,
				},
			}
		}

		return {
			ok: false,
			error: {
				matches: [],
				totalMatches: 0,
				truncated: false,
				error: `Failed to spawn ast-grep: ${errorMessage(error)}`,
			},
		}
	}
}

function isNoEntryError(error: unknown): boolean {
	if (typeof error !== "object" || error === null) {
		return false
	}

	const code = Reflect.get(error, "code")
	const message = errorMessage(error)
	return code === "ENOENT" || message.includes("ENOENT") || message.includes("not found")
}

function errorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message
	}
	return String(error)
}
