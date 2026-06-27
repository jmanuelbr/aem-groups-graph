package com.adobe.aem.groupsgraph.core.graph;

import org.apache.sling.api.resource.ResourceResolver;

/**
 * Builds a graph of every group a given principal belongs to, directly or transitively
 * (the {@code memberOf} / ancestor direction).
 */
public interface MembershipGraphService {

    /**
     * Traverse the group memberships of {@code principalId} upward, breadth-first, computing the
     * shortest-path depth of every reachable group from the principal.
     *
     * <p>All reads are performed with the supplied {@code resolver}, so the result only ever
     * contains principals the caller is allowed to see.</p>
     *
     * @param resolver    the caller's resource resolver (its session drives all reads)
     * @param principalId the id of the user or group to start from
     * @param maxNodes    safety cap on the number of nodes; traversal stops and flags
     *                    {@link GraphData#truncated()} once exceeded
     * @return the graph, or {@code null} if no authorizable with that id exists / is visible
     */
    GraphData buildGraph(ResourceResolver resolver, String principalId, int maxNodes);
}
