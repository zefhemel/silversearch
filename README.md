# Silversearch

This is a full-text searching plug for [Silverbullet](https://silverbullet.md/). The goal is maximum usability straight out of the box. It's *heavily* based and uses code from [Omnisearch](https://github.com/scambier/obsidian-omnisearch) for Obsidian (so give this guy a star not me) and also uses [Minisearch](https://github.com/lucaong/minisearch) under the hood.

![](https://raw.githubusercontent.com/mrmugame/silversearch/main/docs/demo.webp)

## Installation

The plug is installed like any other plug using SpaceLua. Just add `"ghr:MrMugame/silversearch"` to the `plugs` array on your `CONFIG` page.
```lua
config.set {
  plugs = {
    "ghr:MrMugame/silversearch"
  }
}
```
Then, run the `Plugs: Update` update command to download and install the plug.

## Usage

You can open the search dialog using the `Silversearch: Search` command (`Ctrl-s`/`Cmd-s`). Simply start typing to begin your search, helpful tips for refining your searches will appear at the start. If Silversearch is missing the most up-to-date content, you can rebuild the search database using the `Silversearch: Full Reindex` command.

To integrate Silversearch with SpaceLua, use the following syscalls:

- `silversearch.search(searchTerm: string, singleFilePath?: string): ResultPage[]`: Searches the database using the `searchTerm`, which supports all functions the normal search also supports (e.g. `ext`, etc.). If `singleFilePath` is provided it will only search the provided file. The function will return an array of [`ResultPage`](https://github.com/MrMugame/silversearch/blob/5c4a3b57a8f92336c5e2b1ae29ff9d4b668cd470/shared/global.ts#L6)
- `silversearch.openSearch(defaultQuery: string = ""): void`: This opens the search modal. If a default query is provided it will be inserted into the search field.
- `silversearch.reindex(): void`: Rebuilds the search database.

## Settings

Silversearch can be configured using SpaceLua
```lua
config.set {
  silversearch = {
    -- Weighs specific fields more
    weights = {
      basename = 15
      -- Also available: tags, aliases, directory, displayName, content
    },
    -- Weighs pages with specific attributes set through frontmatter more if that attribute is included in the search
    weightCustomProperties = {
      books = 10
    },
    -- Files that have been edited more recently than, will be weighed more. Options are "day", "week", "month" or "disabled"
    recencyBoost = "week",
    -- Rank specific folders down
    downrankedFoldersFilters = {"Library/"},
    -- Normalize diatrics in queries and search terms. Words like "brûlée" or "žluťoučký" will be indexed as "brulee" and "zlutoucky".
    ignoreDiacritics = true,
    -- Similar to `ignoreDiacritics` but for arabic diatritics
    ignoreArabicDiacritics = false,
    -- Breaks urls down into searchable words
    tokenizeUrls = true,
    -- Breaks words seperated with camel case into searchable words
    splitCamelCase = true,
    -- Increases the fuzziness of the full-text search, options are "0", "1", "2"
    fuzziness = "1",
    -- Puts newlines into the excerpts as opposed to rendering it as one continous string
    renderLineReturnInExcerpts = true
  }
}
```

## LICENSE

Silversearch is licensed under [GPL-3](https://tldrlegal.com/license/gnu-general-public-license-v3-(gpl-3)).
