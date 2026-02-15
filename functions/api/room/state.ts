import { forward, type Env } from './_helper';

export const onRequestGet: PagesFunction<Env> = async (context) => forward(context, '/state');
