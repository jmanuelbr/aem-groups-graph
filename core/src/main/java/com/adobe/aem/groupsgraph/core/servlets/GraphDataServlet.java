package com.adobe.aem.groupsgraph.core.servlets;

import java.io.IOException;

import javax.servlet.Servlet;

import org.apache.commons.lang3.StringUtils;
import org.apache.sling.api.SlingHttpServletRequest;
import org.apache.sling.api.SlingHttpServletResponse;
import org.apache.sling.api.resource.ResourceResolver;
import org.apache.sling.api.servlets.SlingSafeMethodsServlet;
import org.osgi.service.component.annotations.Component;
import org.osgi.service.component.annotations.Reference;

import com.adobe.aem.groupsgraph.core.graph.GraphData;
import com.adobe.aem.groupsgraph.core.graph.MembershipGraphService;
import com.adobe.aem.groupsgraph.core.security.PrincipalAccess;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Returns the membership graph for the principal given via the {@code principal} request parameter
 * as JSON. Admin-only; reads with the caller's own session.
 *
 * <p>Bound by resource type to the backing node at
 * {@code /apps/groupsgraph/endpoints/graph}, so the client calls
 * {@code /apps/groupsgraph/endpoints/graph.json?principal=<id>}.</p>
 */
@Component(
        service = Servlet.class,
        property = {
                "sling.servlet.resourceTypes=groupsgraph/endpoints/graph",
                "sling.servlet.methods=GET",
                "sling.servlet.extensions=json"
        })
public class GraphDataServlet extends SlingSafeMethodsServlet {

    private static final long serialVersionUID = 1L;
    private static final int DEFAULT_MAX_NODES = 500;
    private static final int MAX_ALLOWED_NODES = 2000;

    private final transient ObjectMapper mapper = new ObjectMapper();

    @Reference
    private transient MembershipGraphService graphService;

    @Override
    protected void doGet(SlingHttpServletRequest request, SlingHttpServletResponse response)
            throws IOException {

        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");

        ResourceResolver resolver = request.getResourceResolver();
        if (!PrincipalAccess.isAdmin(resolver)) {
            response.setStatus(SlingHttpServletResponse.SC_FORBIDDEN);
            mapper.writeValue(response.getWriter(), new ErrorResponse("Administrator access required."));
            return;
        }

        String principalId = request.getParameter("principal");
        if (StringUtils.isBlank(principalId)) {
            response.setStatus(SlingHttpServletResponse.SC_BAD_REQUEST);
            mapper.writeValue(response.getWriter(), new ErrorResponse("Missing 'principal' parameter."));
            return;
        }

        int maxNodes = resolveMaxNodes(request.getParameter("maxNodes"));
        GraphData data = graphService.buildGraph(resolver, principalId, maxNodes);
        if (data == null) {
            response.setStatus(SlingHttpServletResponse.SC_NOT_FOUND);
            mapper.writeValue(response.getWriter(),
                    new ErrorResponse("No principal found with id '" + principalId + "'."));
            return;
        }

        mapper.writeValue(response.getWriter(), data);
    }

    private int resolveMaxNodes(String raw) {
        if (StringUtils.isBlank(raw)) {
            return DEFAULT_MAX_NODES;
        }
        try {
            int requested = Integer.parseInt(raw.trim());
            if (requested < 1) {
                return DEFAULT_MAX_NODES;
            }
            return Math.min(requested, MAX_ALLOWED_NODES);
        } catch (NumberFormatException e) {
            return DEFAULT_MAX_NODES;
        }
    }

    /** Minimal JSON error envelope. */
    private record ErrorResponse(String error) {
    }
}
