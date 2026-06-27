package com.adobe.aem.groupsgraph.core.graph;

import java.util.List;

/**
 * The full result of a membership traversal, ready to be serialised to JSON for the client.
 *
 * @param rootId    the id of the principal the graph was built for
 * @param nodes     every reachable principal, including the root (depth 0)
 * @param edges     every membership relation discovered during traversal
 * @param truncated {@code true} when traversal hit the node cap and stopped early
 */
public record GraphData(
        String rootId,
        List<GraphNode> nodes,
        List<GraphEdge> edges,
        boolean truncated) {
}
