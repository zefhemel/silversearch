# Silversearch

This is a full-text searching plug for [Silverbullet](https://silverbullet.md/). The goal is maximum usability straight out of the box. It's *heavily* based and uses code from [Omnisearch](https://github.com/scambier/obsidian-omnisearch) for Obsidian (so give this guy a star not me) and also uses [Minisearch](https://github.com/lucaong/minisearch) under the hood.

![](https://raw.githubusercontent.com/mrmugame/silversearch/main/docs/demo.webp)

## Installation

The plug is installed like any other plug using SpaceLua, just add the following into a SpaceLua block somewhere in your Space.
```lua
config.set {
  plugs = {
    "ghr:MrMugame/silversearch"
  }
}
```

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
    -- Weighs Pages with specific attributes set through frontmatter more if that attribute is included in the search
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
