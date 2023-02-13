import { mark } from 'mote/base/common/performance';

export enum PerformanceMarkPoint {
	CreateWindow,
}

interface MarkLifecycle {
	willMark: string;
	didMark: string;
}

export namespace PerformanceMark {

	export const willCreateWindow = 'willCreateMoteWindow';
	export const didCreateWindow = 'didCreateMoteWindow';

	const markPair: { [key in PerformanceMarkPoint]: MarkLifecycle } = {
		[PerformanceMarkPoint.CreateWindow]: {
			willMark: willCreateWindow,
			didMark: didCreateWindow,
		}
	};

	export function withMark(markPoint: PerformanceMarkPoint, callback: () => void): void {
		const markLifeCycle = getMarkLifecycle(markPoint);
		mark(markLifeCycle.willMark);
		callback();
		mark(markLifeCycle.didMark);
	}

	export function willMark(markPoint: PerformanceMarkPoint): void {
		const markLifeCycle = getMarkLifecycle(markPoint);
		mark(markLifeCycle.willMark);
	}

	export function didMark(markPoint: PerformanceMarkPoint): void {
		const markLifeCycle = getMarkLifecycle(markPoint);
		mark(markLifeCycle.didMark);
	}

	export function getPair(markPoint: PerformanceMarkPoint): [string, string] {
		const markLifeCycle = getMarkLifecycle(markPoint);
		return [markLifeCycle.willMark, markLifeCycle.didMark];
	}

	function getMarkLifecycle(markPoint: PerformanceMarkPoint) {
		return markPair[markPoint];
	}
}
