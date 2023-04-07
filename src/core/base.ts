import { Client } from 'discord.js';
import { log } from '@core/utils';
import {
	BoundEvent,
	BoundEventCallback,
	BoundEventTarget,
	TargetEvents,
} from './types';
import { NONAME } from 'dns';

export type NoParamCallback = () => void | Promise<void>;

const enum ELoadableState {
	INACTIVE = 'Inactive',
	ACTIVE = 'Active',
	LOADING = 'Loading',
	DESTROYING = 'Destroying',
}

export { ELoadableState };

/**
 * Base class for all Classes that will need a load => destroy lifecycle.
 */
export abstract class Loadable {
	/**
	 * Events that will be unbound when {@link this | this} class will be {@link destroy | destroyed}
	 */
	events: BoundEvent<any>[] = [];

	/**
	 * The internal state of this {@link Loadable| Loadable}
	 */
	private _state: ELoadableState = ELoadableState.INACTIVE;

	/**
	 * All callbacks relating to state changes
	 */
	_stateCallbacks: Map<ELoadableState, NoParamCallback[]> = new Map();

	constructor() {}

	set state(newState: ELoadableState) {
		if (newState === ELoadableState.INACTIVE) {
			for (let i = 0; i < this.events.length; i++) {
				this.events[i].target.off(
					this.events[i].event,
					this.events[i].callback
				);
			}

			this.events = [];
		}

		if (this._stateCallbacks.has(newState)) {
			this._stateCallbacks.get(newState)!.forEach((c) => c());
			this._stateCallbacks.delete(newState);
		}

		this._state = newState;
	}

	get state() {
		return this._state;
	}

	/**
	 * All events added will be automatically unbounded when {@link destroy | destroy} is called
	 * @param events
	 */
	bindEvent<E extends TargetEvents, K extends keyof E>(
		target: BoundEvent<E, K>['target'],
		event: K,
		callback: BoundEventCallback<E[K]>
	) {
		this.events.push({
			target,
			event,
			callback,
		});

		target.on(event, callback);
	}

	// /**
	//  * All events added will be automatically unbounded when {@link destroy | destroy} is called
	//  * @param events
	//  */
	// bindEvents<
	// 	E extends TargetEvents = TargetEvents,
	// 	T extends BoundEventTarget<E> = BoundEventTarget<E>
	// >(events: BoundEvent<E, T>[]) {
	// 	this.events.push(
	// 		...events.map((e) => {
	// 			e.target.on(e.event, e.callback);
	// 			return e;
	// 		})
	// 	);
	// }

	/**
	 * Sets the state to newState if its not already 'newState'. if the state
	 * is already 'newState' it just waits for 'waitForState'
	 * @param newState
	 * @param waitForState
	 * @returns true if we set the state, false if we waited for the state to change
	 */
	async setAndWaitForState(
		newState: ELoadableState,
		waitForState: ELoadableState
	) {
		if (this.state === newState) {
			await this.waitForState(waitForState);
			return false;
		}
		this.state = newState;
		return true;
	}

	/**
	 * load this {@link Loadable | Loadable}
	 * @returns
	 */
	async load(old?: this) {
		if (
			!(await this.setAndWaitForState(
				ELoadableState.LOADING,
				ELoadableState.ACTIVE
			))
		)
			return;

		await this.onLoad(old).catch(this.onLoadError.bind(this));
		this.state = ELoadableState.ACTIVE;
	}

	/**
	 * Can be used to handle {@link load| load} errors
	 * @param error
	 */
	async onLoadError(error: Error) {}

	/**
	 * Called during {@link load | load},Child classes can override this for initialization
	 * @param old The old instance just before it is discarded (if one exists)
	 */
	async onLoad(old?: this) {}

	/**
	 * Waits for the state to change to 'state'
	 * @param state
	 * @returns
	 */
	async waitForState(state: ELoadableState) {
		if (this.state === state) return;
		return new Promise<void>((resolve) => {
			if (!this._stateCallbacks.has(state)) {
				this._stateCallbacks.set(state, [resolve]);
			} else {
				this._stateCallbacks.get(state)!.push(resolve);
			}
		});
	}

	/**
	 * destroy this {@link Loadable | Loadable}
	 * @returns
	 */
	async destroy() {
		if (
			!(await this.setAndWaitForState(
				ELoadableState.DESTROYING,
				ELoadableState.INACTIVE
			))
		)
			return;

		await this.onDestroy();

		log('Finished Destroy');
		this.state = ELoadableState.INACTIVE;
		log('Resolved callbacks');
	}

	/**
	 * Called during {@link destroy | destroy}, Child classess can override this for cleanup
	 */
	async onDestroy() {}
}

/**
 * Base class for all Modules the bot has
 */
export abstract class BotModule extends Loadable {
	/**
	 * A reference to the actual bot
	 */
	bot: Client;

	constructor(bot: Client) {
		super();
		this.bot = bot;
	}

	async onLoadError(error: Error): Promise<void> {
		log('Error loading module', this.constructor.name, '\n', error);
	}
}
