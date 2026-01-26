export function patchMethod<T extends object, K extends keyof T>(
	target: T,
	key: K,
	wrap: (original: T[K]) => T[K],
): () => void {
	const original = target[key];
	target[key] = wrap(original);
	return () => {
		target[key] = original;
	};
}
