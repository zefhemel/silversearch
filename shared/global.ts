export type SearchMatch = {
    match: string;
    offset: number;
}

export type ResultPage = {
    score: number;
    ref: string;
    basename: string;
    content: string;
    foundWords: string[];
    matches: SearchMatch[];

    matchesName: SearchMatch[];
    excerpts: ResultExcerpt[];
}

export type ResultExcerpt = {
    offset: number;
    excerpt: string;
}