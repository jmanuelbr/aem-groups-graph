package com.adobe.aem.groupsgraph.core.graph;

/**
 * A single principal (the selected root, or a group it belongs to) in the membership graph.
 *
 * @param id     the authorizable id (unique key used for edges)
 * @param name   a human friendly display name (falls back to the id)
 * @param path   the JCR path under /home (for the details panel)
 * @param type   {@code "user"} for the root principal when it is a user, otherwise {@code "group"}
 * @param depth  shortest number of membership hops from the root principal (root is 0)
 * @param system whether this is a built-in / system group (used by the "hide system" toggle)
 */
public record GraphNode(
        String id,
        String name,
        String path,
        String type,
        int depth,
        boolean system) {
}
