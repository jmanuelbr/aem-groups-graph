package com.adobe.aem.groupsgraph.core.models;

import org.apache.sling.api.SlingHttpServletRequest;
import org.apache.sling.api.resource.ResourceResolver;
import org.apache.sling.models.annotations.Model;
import org.apache.sling.models.annotations.injectorspecific.Self;

import com.adobe.aem.groupsgraph.core.security.PrincipalAccess;

/**
 * Backs the tool page's HTL: lets the markup render the tool only for administrators and an
 * access-denied notice for everyone else. This is the page-level half of the admin-only gate;
 * the data endpoints enforce the same rule independently.
 */
@Model(adaptables = SlingHttpServletRequest.class)
public class ToolAccessModel {

    @Self
    private SlingHttpServletRequest request;

    private Boolean allowed;

    /**
     * @return {@code true} when the current user may use the tool.
     */
    public boolean isAllowed() {
        if (allowed == null) {
            ResourceResolver resolver = request.getResourceResolver();
            allowed = PrincipalAccess.isAdmin(resolver);
        }
        return allowed;
    }
}
