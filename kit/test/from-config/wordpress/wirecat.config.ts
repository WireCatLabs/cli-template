import { defineCli } from "@wirecat/cli-core/manifest"

// WordPress's posts and pages: every status, sorted by id to list and by change time to sync.
const STATUSES = "publish,future,draft,pending,private,trash"
const posts = (operation: string, type: "post" | "page") => {
  const list = { operation, query: { context: "edit", status: STATUSES, per_page: 100, orderby: "id", order: "asc" } }
  return {
    list,
    changes: {
      operation,
      query: { ...list.query, orderby: "modified", modified_after: "{since}" },
      since: "iso" as const,
      keyset: { field: "modified_gmt" },
    },
    ids: { operation, query: { context: "edit", status: STATUSES, per_page: 100, orderby: "id", _fields: "id" } },
    get: { operation: `${operation}ById`, path: { id: "{id}" }, query: { context: "edit" } },
    map: {
      externalId: "id",
      type: { value: type },
      title: "title.raw",
      excerpt: "excerpt.raw",
      url: "link",
      slug: "slug",
      status: {
        path: "status",
        map: {
          publish: "published",
          future: "scheduled",
          draft: "draft",
          pending: "pending",
          private: "private",
          trash: "trashed",
        },
      },
      publishedAt: "date_gmt",
      scheduledFor: "date_gmt",
      updatedAt: "modified_gmt",
      version: "modified_gmt",
      authors: "author",
      terms: { all: ["tags", "categories"] },
    },
    body: {
      path: "content.raw",
      format: "wp-blocks" as const,
      fallback: { path: "content.rendered", format: "html" as const },
    },
    optional: {
      message: "the sign-in may not read every post: a contributor sees its own",
      scope: "edit_others_posts",
      requires: {
        operation: "getWpV2UsersMe",
        query: { context: "edit", _fields: "capabilities" },
        check: "capabilities.edit_others_posts",
      },
    },
  }
}

export default defineCli({
  identity: {
    command: "acmewp",
    package: "@example/acmewp-cli",
    prefix: "WCACMEWP",
    service: "WordPress",
    owner: "example",
  },
  spec: { kind: "wp-json", from: "https://wp.acme.example/wp-json/", version: "6.9.4" },
  auth: { preset: "app-password", verify: { operation: "getWpV2UsersMe", id: "id", name: "name" } },
  category: "content",
  source: {
    provider: "wordpress",
    kinds: ["author", "term", "post"],
    channel: { kind: "blog", network: "wordpress" },
    entities: {
      author: [
        {
          list: { operation: "getWpV2Users", query: { context: "edit", per_page: 100, orderby: "id" } },
          get: { operation: "getWpV2UsersById", path: { id: "{id}" }, query: { context: "edit" } },
          map: { externalId: "id", name: "name", email: "email", slug: "slug" },
          optional: { message: "only an editor or administrator lists the users", scope: "list_users" },
        },
      ],
      term: [
        {
          list: { operation: "getWpV2Tags", query: { context: "edit", per_page: 100, orderby: "id" } },
          get: { operation: "getWpV2TagsById", path: { id: "{id}" }, query: { context: "edit" } },
          map: { externalId: "id", kind: { value: "tag" }, name: "name", slug: "slug" },
        },
        {
          list: { operation: "getWpV2Categories", query: { context: "edit", per_page: 100, orderby: "id" } },
          get: { operation: "getWpV2CategoriesById", path: { id: "{id}" }, query: { context: "edit" } },
          map: { externalId: "id", kind: { value: "category" }, name: "name", slug: "slug" },
        },
      ],
      post: [posts("getWpV2Posts", "post"), posts("getWpV2Pages", "page")],
    },
    writes: {
      create: { operation: "postWpV2Posts", body: { status: "draft" } },
      update: { operation: "postWpV2PostsById", path: { id: "{id}" } },
      trash: { operation: "deleteWpV2PostsById", path: { id: "{id}" } },
      delete: { operation: "deleteWpV2PostsById", path: { id: "{id}" }, query: { force: true } },
      fields: {
        title: "title.raw",
        body: "content.raw",
        excerpt: "excerpt.raw",
        slug: "slug",
        terms: { tag: "tags", category: "categories" },
      },
      publish: { status: "publish" },
      schedule: { status: "future", date_gmt: "{at}" },
      unpublish: { status: "draft" },
    },
  },
})
