package com.adobe.aem.groupsgraph.core.graph;

/**
 * A directed membership relation: {@code source} is a (declared) member of {@code target}.
 *
 * @param source the member authorizable id
 * @param target the group authorizable id the member belongs to
 */
public record GraphEdge(String source, String target) {
}
