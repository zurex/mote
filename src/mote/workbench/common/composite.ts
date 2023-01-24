export interface IComposite {

	/**
	 * Returns the unique identifier of this composite.
	 */
	getId(): string;

	/**
	 * Asks the underlying control to focus.
	 */
	focus(): void;
}

/**
 * Marker interface for the composite control
 */
export interface ICompositeControl { }
