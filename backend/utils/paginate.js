/* Opt-in pagination.
 *
 * Existing clients call these endpoints with no query string and expect the
 * whole collection back as an array, so paging only kicks in when the caller
 * explicitly asks for it with ?page or ?limit. That keeps the response shape
 * unchanged for the current frontend while giving the admin panel and any
 * future client a way to avoid pulling everything at once.
 *
 *   GET /api/events              -> every event, as before
 *   GET /api/events?page=2       -> second page, plus a `meta` block
 *   GET /api/events?limit=10     -> first 10, plus a `meta` block
 */

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const toPositiveInt = (value) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

function pageParams(query = {}) {
  const requested = query.page !== undefined || query.limit !== undefined;

  const page = toPositiveInt(query.page) || 1;
  const limit = Math.min(toPositiveInt(query.limit) || DEFAULT_LIMIT, MAX_LIMIT);

  return { enabled: requested, page, limit, skip: (page - 1) * limit };
}

/* Runs a query with paging applied when requested, and returns the rows
 * alongside a meta block the caller can pass straight into the response. */
async function paginate(Model, filter, sort, query, populate) {
  const { enabled, page, limit, skip } = pageParams(query);

  let cursor = Model.find(filter).sort(sort);
  if (enabled) cursor = cursor.skip(skip).limit(limit);

  // populate may be a single spec or a list of them.
  if (populate) {
    for (const spec of [].concat(populate)) {
      cursor = cursor.populate(spec.path, spec.select);
    }
  }

  const rows = await cursor;

  if (!enabled) return { rows, meta: null };

  const total = await Model.countDocuments(filter);

  return {
    rows,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      hasMore: skip + rows.length < total,
    },
  };
}

module.exports = { pageParams, paginate, DEFAULT_LIMIT, MAX_LIMIT };
