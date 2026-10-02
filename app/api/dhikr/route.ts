import { env } from 'cloudflare:workers';
import { database } from '@/db';
import { createHandler } from '@/lib/api';
export const dynamic = 'force-dynamic';
const handler=createHandler({db:database,env});
export const GET=handler;
export const POST=handler;
