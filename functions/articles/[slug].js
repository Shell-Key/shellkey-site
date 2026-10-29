// GET /articles/<slug>: one article
import { renderArticle } from "../_articles.js";
export async function onRequestGet({ env, request, params }) { return renderArticle(env, request, String(params.slug || "")); }
