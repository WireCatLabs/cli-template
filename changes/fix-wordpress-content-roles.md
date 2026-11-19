### Fixed

- **A content CLI made from a config syncs an Author's or Contributor's posts.** The WordPress case gives the pages
  call `optional.needs` on `capabilities.edit_pages` (cli-core 0.710.0): WordPress refuses both roles the pages list,
  and that refusal failed the whole post sync. Pages now check `edit_others_pages`, not `edit_others_posts`. A
  content CLI's seed tests that a sign-in without a call's right never sends it and still completes its sync.
