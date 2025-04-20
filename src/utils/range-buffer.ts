interface PlainRange {
	from: number;
	to: number;
}

export class RangeBuffer {
	private _buffer: Uint32Array<ArrayBuffer>;
	public readonly length: number;

	constructor(length: number) {
		this._buffer = new Uint32Array(length * 2);
		this.length = length;
	}

	public get(offset: number): PlainRange | void {
		let realOffset = offset * 2;
		if (realOffset < 0 || realOffset >= this._buffer.length)
			return;
		return {
			from: this._buffer[realOffset - 1],
			to: this._buffer[realOffset]
		}
	}

	public set(offset: number, range: PlainRange): void {
		let realOffset = offset * 2;
		if (realOffset >= 0 && realOffset < this._buffer.length) {
			this._buffer[realOffset - 1] = range.from;
			this._buffer[realOffset] = range.to;
		}
	}

	public flush(): void {
		this._buffer = new Uint32Array(this.length * 2);
	}
}