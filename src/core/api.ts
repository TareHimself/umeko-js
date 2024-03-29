import axios from 'axios';

export const DatabaseApi = axios.create({
	baseURL: process.env.DB_API,
	headers: {
		'x-api-key': process.env.DB_API_TOKEN || '',
	},
});

export const ServerApi = axios.create({
	baseURL: process.env.SERVER_API,
});
