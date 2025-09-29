<script lang="ts"></script>

<div class="silversearch-help">
    <p>Add the following to your query to refine the search:</p>
    <ul>
        <li>
            Use <code>path:&quot;Library&quot;</code> to restrict your results
            to paths which include &quot;Library&quot;
        </li>
        <li>
            Use <code>ext:pdf,jpg</code> or <code>ext:png</code>, or
            a plain <code>.png</code> to restrict your search to certain filetypes
        </li>
        <li>
            Use <code>&quot;exact expressions&quot;</code> in quotes to further filter
            the results returned by the query
        </li>
        <li>
            Use <code>-apple -pie</code> to exclude notes containing the words
            &quot;apple&quot; and &quot;pie&quot;
        </li>
    </ul>
</div>

<style>
    .silversearch-help {
        padding: 8px;
        line-height: 1.5;
        color: var(--modal-help-color);
    }

    .silversearch-help p {
        margin: 0px;
    }

    .silversearch-help ul {
        margin: 0px;
        list-style-position: inside;
        padding-left: 15px;
    }
</style>
