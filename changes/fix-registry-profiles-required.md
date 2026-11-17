### Changed — may break callers

- **The `server.json` that `new` writes asks which profiles to serve.** It started `mcp serve --profiles all`, so a
  client that installed a new CLI's server from the MCP Registry reached every account on the computer without the
  owner choosing. Now `--profiles` is a required argument with the example `personal`: the client asks for one
  profile, a comma-separated list or `all`. Why: a CLI never picks an account for the owner
  ([WC-MCP-9](https://github.com/WireCatLabs/cli-base/blob/main/docs/standards/mcp.md#wc-mcp-9--a-server-serves-the-profiles-it-is-told-with-one-connection-for-each)). Watch for: `server.json` is a seed, so `upgrade` does not change it in a CLI made before;
  make the same change there by hand.
