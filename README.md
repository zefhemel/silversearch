# Silversearch

This is a full-text searching plug for [Silverbullet](https://silverbullet.md/). The goal is maximum usability straight out of the box. It's *heavily* based and uses code from [Omnisearch](https://github.com/scambier/obsidian-omnisearch) for Obsidian (so give this guy a star not me) and also uses [Minisearch](https://github.com/lucaong/minisearch) under the hood.

![](https://raw.githubusercontent.com/mrmugame/silversearch/main/docs/demo.webp)

## Installation

The plug is installed like any other plug using SpaceLua. Just add the following into a SpaceLua block somethere in your Space.
```lua
config.set {
  plugs = {
    "ghr:MrMugame/silversearch"
  }
}
```

Due to some "bugs" in Silverbullet you have to set the following SpaceStyle to achieve the proper UI experience.
```css
.sb-panel iframe {
  background: transparent;
}
.sb-modal {
  border: none;
  background-color: transparent;
}
```

## LICENSE

Silversearch is licensed under [GPL-3](https://tldrlegal.com/license/gnu-general-public-license-v3-(gpl-3)).
