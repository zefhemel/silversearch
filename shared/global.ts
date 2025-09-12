export type SearchMatch = {
    match: string;
    offset: number;
}

export type ResultPage = {
    score: number;
    name: string;
    basename: string;
    content: string;
    foundWords: string[];
    matches: SearchMatch[];

    matchesName: SearchMatch[];
    excerpts: ResultExcerpt[];

    navigationMap?: NavigationMap;
}

export type ResultExcerpt = {
    offset: number;
    excerpt: string;
}

export type NavigationRoute =
    | { type: "range", from: number, to: number, tail: string }

export type NavigationMap = NavigationRoute[];