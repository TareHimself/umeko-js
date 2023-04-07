import { ClusterManager } from 'discord-hybrid-sharding';
import { GuildMember, TextBasedChannel, VoiceBasedChannel } from 'discord.js';

export const enum ELoopType {
	NONE = 'off',
	SONG = 'song',
	QUEUE = 'queue',
}

export const enum EQueueSource {
	COMMAND = 0,
	QUEUE = 1,
	SAVED_QUEUE = 2,
}

export const enum ECommandType {
	SLASH = 1,
	USER_CONTEXT_MENU = 2,
	CHAT_CONTEXT_MENU = 3,
}

export const enum EUmekoCommandContextType {
	CHAT_MESSAGE = 0,
	SLASH_COMMAND = 1,
	MESSAGE_CONTEXT_MENU = 2,
	USER_CONTEXT_MENU = 3,
}

export const enum ECommandOptionType {
	SUB_COMMAND = 1,
	STRING = 3,
	INTEGER = 4,
	BOOLEAN = 5,
	USER = 6,
	CHANNEL = 7,
	ROLE = 8,
}

export const enum EMusicCheckType {
	SEARCH = 0,
	SPOTIFY_TRACK = 1,
	SPOTIFY_ALBUMN = 2,
	SPOTIFY_PLAYLIST = 3,
}

export interface IMusicUrlCheck {
	type: EMusicCheckType;
	id?: string;
}

export interface ICommandOption {
	name: string;
	description: string;
	type: ECommandOptionType;
	required: boolean;
	choices?: { name: string; value: string }[];
}

export interface ISong {
	id: string;
	track: string;
	title: string;
	uri: string;
	length: number;
	requester: GuildMember;
	groupURL?: string;
}

export interface ISavedSong {
	member: string;
	uri: string;
}

export interface ISavedQueue {
	identifier?: string;
	id: string;
	channel: string;
	voice: string;
	songs: ISavedSong[];
	loopType: ELoopType;
	volume: number;
}

export interface ILoadedQueue {
	identifier?: string;
	id: string;
	channel: TextBasedChannel;
	voice: VoiceBasedChannel;
	songs: ISong[];
	loopType: ELoopType;
	volume: number;
}

export interface IOsuApiUser {
	id: string;
	avatar_url: string;
	country_code: string;
	is_online: boolean;
	username: string;
	country: {
		code: string;
		name: string;
	};
	playmode: string;
	statistics: {
		global_rank: number;
		hit_accuracy: number;
	};
}

export interface IWallpaperzWallpaper {
	id: string;

	width: number;

	height: number;

	downloads: number;

	uploaded_at: number;

	uploader: string;

	tags: string;
}

export interface IMALAnime {}

export interface IDiscordApiCommand {
	name: string;
	description?: string;
	options?: IDiscordApiCommand[] | ICommandOption[];
	type?: ECommandType | ECommandOptionType;
}

export type Awaitable<T> = T | Promise<T>;

export type BoundEventCallback<
	T extends ((...args: any[]) => Awaitable<void>) | any[]
> = T extends any[] ? (...args: T) => Awaitable<void> : T;

export type TargetEvents = {
	[key: string | symbol | number]: BoundEventCallback<any>;
};

export interface BoundEventTarget<E extends TargetEvents> {
	on: <T extends keyof E>(event: T, callback: BoundEventCallback<E[T]>) => any;
	off: <T extends keyof E>(event: T, callback: BoundEventCallback<E[T]>) => any;
}

export type BoundEvent<E extends TargetEvents, K extends keyof E = keyof E> = {
	target: BoundEventTarget<E>;
	event: K;
	callback: BoundEventCallback<E[K]>;
};

declare global {
	var ClusterManager: ClusterManager;
}

declare function bindEvent<
	T extends BoundEventTarget<TargetEvents>,
  E extends T extends BoundEventTarget<infer E>
    ? E
    : never,
  K extends keyof E
>(target: T, event: K, callback: BoundEventCallback<E[K]>): void;

declare const bot: BoundEventTarget<ClientEvents>;

type ClientEvents = {
	messageCreate: BoundEventCallback<string[]>;
};

bindEvent(bot as BoundEventTarget<ClientEvents>,'messageCreate', (m1, m2) => {});

type IncorrectEvents = {
	messageCreate: BoundEventCallback<number[]>;
};

bindEvent(
	bot,
	'messageCreate',
	(m1, m2) => {}
);
