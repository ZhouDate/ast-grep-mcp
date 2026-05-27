type SpawnedProcess = {
	stdout: ReadableStream | null
	stderr: ReadableStream | null
	exited: Promise<number>
	kill: () => void
}

export async function collectProcessOutputWithTimeout(
	process: SpawnedProcess,
	timeoutMs: number
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
	const timeoutPromise = new Promise<never>((_, reject) => {
		const timeoutId = setTimeout(() => {
			process.kill()
			reject(new Error(`Search timeout after ${timeoutMs}ms`))
		}, timeoutMs)
		process.exited.then(() => clearTimeout(timeoutId))
	})

	const stdoutPromise = process.stdout ? new Response(process.stdout).text() : Promise.resolve("")
	const stderrPromise = process.stderr ? new Response(process.stderr).text() : Promise.resolve("")

	const [stdout, stderr, exitCode] = await Promise.race([
		Promise.all([stdoutPromise, stderrPromise, process.exited]),
		timeoutPromise
	])

	return { stdout, stderr, exitCode }
}
