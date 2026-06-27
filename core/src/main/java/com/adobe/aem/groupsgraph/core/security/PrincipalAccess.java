package com.adobe.aem.groupsgraph.core.security;

import java.util.Iterator;

import org.apache.jackrabbit.api.security.user.Authorizable;
import org.apache.jackrabbit.api.security.user.Group;
import org.apache.jackrabbit.api.security.user.UserManager;
import org.apache.sling.api.resource.ResourceResolver;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Central admin-only gate for the tool. Both the data endpoints and the page guard use this so the
 * access rule lives in exactly one place.
 */
public final class PrincipalAccess {

    private static final Logger LOG = LoggerFactory.getLogger(PrincipalAccess.class);
    private static final String ADMIN_USER = "admin";
    private static final String ADMINISTRATORS_GROUP = "administrators";

    private PrincipalAccess() {
    }

    /**
     * @return {@code true} if the resolver's user is the {@code admin} user or a (transitive)
     *         member of the {@code administrators} group.
     */
    public static boolean isAdmin(ResourceResolver resolver) {
        if (resolver == null) {
            return false;
        }
        String userId = resolver.getUserID();
        if (ADMIN_USER.equals(userId)) {
            return true;
        }
        try {
            UserManager userManager = resolver.adaptTo(UserManager.class);
            if (userManager == null) {
                return false;
            }
            Authorizable user = userManager.getAuthorizable(userId);
            if (user == null || user.isGroup()) {
                return false;
            }
            Iterator<Group> groups = user.memberOf();
            while (groups.hasNext()) {
                if (ADMINISTRATORS_GROUP.equals(groups.next().getID())) {
                    return true;
                }
            }
        } catch (Exception e) {
            LOG.warn("Could not determine admin status for user '{}'", userId, e);
        }
        return false;
    }
}
