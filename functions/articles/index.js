// GET /articles: list of published weekly articles
import { renderIndex } from "../_articles.js";
export async function onRequestGet({ env, request }) { return renderIndex(env, request); }
