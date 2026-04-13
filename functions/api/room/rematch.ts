import { forward, type Env } from './_helper';

export const onRequestPost: PagesFunction<Env> = async (context) => forward(context, '/rematch');
