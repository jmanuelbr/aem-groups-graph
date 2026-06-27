/*
 * Groups Membership Graph - client side controller.
 *
 * Wires the Coral autocomplete principal picker to the suggestion endpoint, fetches the membership
 * graph for the selected principal, and renders it with Cytoscape: nodes coloured by shortest-path
 * depth from the principal, hover-to-trace-path, click-for-details, and a show-OOTB-groups toggle.
 */
(function (document, window) {
    'use strict';

    var SELECTOR_APP = '.groupsgraph__app';

    // Root is a deeper accent so it stands out; each depth steps through a soft pastel ramp.
    var ROOT_COLOR = '#5B6BB5';
    var DEPTH_RAMP = ['#AED3F0', '#BFE3C8', '#FBD9A8', '#E3C9EC', '#F7B9BE', '#A8E0DD', '#F4E6A1', '#C9CDF0'];

    function depthColor(depth) {
        if (depth <= 0) {
            return ROOT_COLOR;
        }
        return DEPTH_RAMP[(depth - 1) % DEPTH_RAMP.length];
    }

    // Group ids are single hyphenated tokens with no spaces, so Cytoscape's whitespace word-wrap
    // can't break them. We pre-wrap into lines (breaking on hyphens, hard-splitting over-long
    // tokens) so the auto-sized box stays compact and the text never overflows.
    var MAX_LINE = 16;

    function wrapLabel(text) {
        var tokens = String(text).split('-');
        var lines = [];
        var current = '';
        for (var i = 0; i < tokens.length; i++) {
            var token = i < tokens.length - 1 ? tokens[i] + '-' : tokens[i];
            while (token.length > MAX_LINE) {
                if (current) { lines.push(current); current = ''; }
                lines.push(token.slice(0, MAX_LINE));
                token = token.slice(MAX_LINE);
            }
            if ((current + token).length > MAX_LINE) {
                if (current) { lines.push(current); }
                current = token;
            } else {
                current += token;
            }
        }
        if (current) { lines.push(current); }
        return lines.join('\n');
    }

    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, function (ch) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
        });
    }

    function GroupsGraph(app) {
        this.app = app;
        this.graphEndpoint = app.getAttribute('data-graph-endpoint');

        this.picker = app.querySelector('.groupsgraph__picker');
        this.showSystem = app.querySelector('.groupsgraph__show-system');
        this.legend = app.querySelector('.groupsgraph__legend');
        this.truncated = app.querySelector('.groupsgraph__truncated');
        this.canvas = app.querySelector('.groupsgraph__canvas');
        this.details = app.querySelector('.groupsgraph__details');
        this.detailsName = app.querySelector('.groupsgraph__details-name');
        this.detailsList = app.querySelector('.groupsgraph__details-list');
        this.detailsClose = app.querySelector('.groupsgraph__details-close');
        this.empty = app.querySelector('.groupsgraph__empty');
        this.spinner = app.querySelector('.groupsgraph__spinner');

        this.cy = null;

        this.bind();
    }

    GroupsGraph.prototype.bind = function () {
        var self = this;

        // The picker is the OOTB Granite authorizable autocomplete (<foundation-autocomplete>),
        // which provides its own user/group suggestions. We just react to the selection.
        if (this.picker) {
            this.picker.addEventListener('change', function () {
                var value = self.getPickerValue();
                if (value) {
                    self.loadGraph(value);
                }
            });
        }

        if (this.showSystem) {
            this.showSystem.addEventListener('change', function () {
                self.applySystemFilter();
            });
        }

        if (this.detailsClose) {
            this.detailsClose.addEventListener('click', function () {
                self.hideDetails();
            });
        }
    };

    // Reads the selected authorizable id from the Granite foundation-autocomplete, tolerating the
    // different shapes its value can take (string, array, or a coral-tag in the value taglist).
    GroupsGraph.prototype.getPickerValue = function () {
        var picker = this.picker;
        if (!picker) {
            return null;
        }
        var value = picker.value;
        if (Array.isArray(value)) {
            value = value[0];
        }
        if (value) {
            return value;
        }
        var tag = picker.querySelector('coral-taglist coral-tag');
        return tag ? tag.getAttribute('value') : null;
    };

    GroupsGraph.prototype.setBusy = function (busy) {
        this.spinner.hidden = !busy;
    };

    GroupsGraph.prototype.loadGraph = function (principalId) {
        var self = this;
        this.empty.hidden = true;
        this.hideDetails();
        this.setBusy(true);

        fetch(this.graphEndpoint + '?principal=' + encodeURIComponent(principalId), {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' }
        }).then(function (response) {
            if (!response.ok) {
                throw new Error('Request failed: ' + response.status);
            }
            return response.json();
        }).then(function (data) {
            self.setBusy(false);
            self.render(data);
        }).catch(function (err) {
            self.setBusy(false);
            self.renderError(err);
        });
    };

    GroupsGraph.prototype.toElements = function (data) {
        var elements = [];
        data.nodes.forEach(function (node) {
            elements.push({
                group: 'nodes',
                data: {
                    id: node.id,
                    name: node.name,
                    label: wrapLabel(node.name),
                    path: node.path,
                    type: node.type,
                    depth: node.depth,
                    system: !!node.system,
                    color: depthColor(node.depth),
                    isRoot: node.id === data.rootId
                }
            });
        });
        data.edges.forEach(function (edge, index) {
            elements.push({
                group: 'edges',
                data: { id: 'e' + index, source: edge.source, target: edge.target }
            });
        });
        return elements;
    };

    GroupsGraph.prototype.render = function (data) {
        var self = this;
        this.rootId = data.rootId;
        this.truncated.hidden = !data.truncated;

        if (this.cy) {
            this.cy.destroy();
        }

        this.cy = window.cytoscape({
            container: this.canvas,
            elements: this.toElements(data),
            minZoom: 0.2,
            maxZoom: 2.5,
            wheelSensitivity: 0.2,
            style: [
                {
                    selector: 'node',
                    style: {
                        'background-color': 'data(color)',
                        'label': 'data(label)',
                        'color': '#23303D',
                        'font-size': '10px',
                        'font-weight': 500,
                        'font-family': 'adobe-clean, sans-serif',
                        'text-valign': 'center',
                        'text-halign': 'center',
                        'text-wrap': 'wrap',
                        'width': 'label',
                        'height': 'label',
                        'padding': '12px',
                        'shape': 'round-rectangle',
                        'border-width': 1,
                        'border-color': '#ffffff',
                        'border-opacity': 0.6,
                        'transition-property': 'opacity, border-width, background-color',
                        'transition-duration': '0.25s'
                    }
                },
                {
                    selector: 'node[?isRoot]',
                    style: {
                        'color': '#ffffff',
                        'font-size': '12px',
                        'font-weight': 700,
                        'border-width': 3,
                        'border-color': '#3B468C',
                        'border-opacity': 1,
                        'padding': '18px'
                    }
                },
                {
                    selector: 'edge',
                    style: {
                        'width': 2,
                        'line-color': '#C7CDD4',
                        'target-arrow-color': '#C7CDD4',
                        'target-arrow-shape': 'triangle',
                        'arrow-scale': 1,
                        'curve-style': 'bezier',
                        'transition-property': 'opacity, line-color, width',
                        'transition-duration': '0.25s'
                    }
                },
                { selector: '.dimmed', style: { 'opacity': 0.15 } },
                { selector: 'node.trace', style: { 'border-width': 3, 'border-color': '#3B468C', 'border-opacity': 1 } },
                { selector: 'edge.trace', style: { 'line-color': '#5B6BB5', 'target-arrow-color': '#5B6BB5', 'width': 3, 'opacity': 1 } },
                { selector: '.is-hidden', style: { 'display': 'none' } }
            ]
        });

        this.bindCyEvents();
        this.applySystemFilter();
        this.buildLegend(data);
    };

    GroupsGraph.prototype.runLayout = function () {
        if (!this.cy) {
            return;
        }

        // Size the layout area to the content (widest tier x slot), so tiers pack tightly instead
        // of breadthfirst spreading them across the full canvas. Slots are comfortably wider/taller
        // than any box, so combined with avoidOverlap nodes never touch.
        var visible = this.cy.nodes().filter(function (n) {
            return n.style('display') !== 'none';
        });
        var counts = {};
        var maxDepth = 0;
        visible.forEach(function (n) {
            var d = n.data('depth');
            counts[d] = (counts[d] || 0) + 1;
            if (d > maxDepth) { maxDepth = d; }
        });
        var maxTier = 1;
        Object.keys(counts).forEach(function (k) {
            if (counts[k] > maxTier) { maxTier = counts[k]; }
        });

        var SLOT_W = 165;
        var SLOT_H = 115;

        this.cy.layout({
            name: 'breadthfirst',
            directed: true,
            roots: this.rootId ? '#' + cssEscape(this.rootId) : undefined,
            boundingBox: { x1: 0, y1: 0, w: maxTier * SLOT_W, h: (maxDepth + 1) * SLOT_H },
            spacingFactor: 1,
            avoidOverlap: true,
            nodeDimensionsIncludeLabels: true,
            padding: 24,
            animate: true,
            animationDuration: 450,
            fit: true
        }).run();
    };

    GroupsGraph.prototype.bindCyEvents = function () {
        var self = this;

        this.cy.on('mouseover', 'node', function (evt) {
            var node = evt.target;
            var trace = node.predecessors().union(node);
            self.cy.elements().addClass('dimmed');
            trace.removeClass('dimmed').addClass('trace');
        });

        this.cy.on('mouseout', 'node', function () {
            self.cy.elements().removeClass('dimmed trace');
        });

        this.cy.on('tap', 'node', function (evt) {
            self.showDetails(evt.target);
        });

        this.cy.on('tap', function (evt) {
            if (evt.target === self.cy) {
                self.hideDetails();
            }
        });
    };

    GroupsGraph.prototype.applySystemFilter = function () {
        if (!this.cy) {
            return;
        }
        // OOTB groups are hidden unless "Show out-of-the-box groups" is checked. The selected
        // principal (root) is always shown, even if it is itself a built-in group.
        var show = this.showSystem && this.showSystem.checked;
        if (show) {
            this.cy.elements().removeClass('is-hidden');
        } else {
            var systemNodes = this.cy.nodes('[?system][!isRoot]');
            systemNodes.addClass('is-hidden');
            systemNodes.connectedEdges().addClass('is-hidden');
        }
        this.runLayout();
    };

    GroupsGraph.prototype.buildLegend = function (data) {
        var maxDepth = 0;
        data.nodes.forEach(function (n) { maxDepth = Math.max(maxDepth, n.depth); });

        var html = '<span class="groupsgraph__legend-item"><span class="groupsgraph__swatch" ' +
            'style="background:' + ROOT_COLOR + '"></span>Selected principal</span>';
        for (var d = 1; d <= maxDepth; d++) {
            html += '<span class="groupsgraph__legend-item"><span class="groupsgraph__swatch" style="background:' +
                depthColor(d) + '"></span>' + d + (d === 1 ? ' hop (direct)' : ' hops') + '</span>';
        }
        this.legend.innerHTML = html;
        this.legend.hidden = false;
    };

    GroupsGraph.prototype.showDetails = function (node) {
        var data = node.data();
        this.detailsName.textContent = data.name;

        var parents = node.outgoers('node').map(function (n) { return n.data('name'); }).sort();
        var rows = [
            ['Id', data.id],
            ['Type', data.type],
            ['Path', data.path],
            ['Depth', data.isRoot ? 'Selected principal' : data.depth + (data.depth === 1 ? ' hop' : ' hops')],
            ['System group', data.system ? 'Yes' : 'No'],
            ['Direct parent groups', parents.length ? parents.join(', ') : '—']
        ];
        this.detailsList.innerHTML = rows.map(function (row) {
            return '<dt>' + escapeHtml(row[0]) + '</dt><dd>' + escapeHtml(row[1]) + '</dd>';
        }).join('');
        this.details.hidden = false;
    };

    GroupsGraph.prototype.hideDetails = function () {
        if (this.details) {
            this.details.hidden = true;
        }
    };

    GroupsGraph.prototype.renderError = function (err) {
        if (this.cy) {
            this.cy.destroy();
            this.cy = null;
        }
        this.legend.hidden = true;
        this.truncated.hidden = true;
        this.empty.hidden = false;
        this.empty.querySelector('p').textContent =
            'Could not load the graph for this principal. ' + (err && err.message ? err.message : '');
    };

    // Minimal CSS.escape fallback for older runtimes.
    function cssEscape(value) {
        if (window.CSS && window.CSS.escape) {
            return window.CSS.escape(value);
        }
        return String(value).replace(/[^a-zA-Z0-9_-]/g, function (ch) {
            return '\\' + ch;
        });
    }

    function init() {
        var apps = document.querySelectorAll(SELECTOR_APP);
        Array.prototype.forEach.call(apps, function (app) {
            if (!app.__groupsGraph) {
                app.__groupsGraph = new GroupsGraph(app);
            }
        });
    }

    // The clientlib loads in <head>, so defer until the DOM (and document.body) exists. We don't
    // depend on Coral being fully upgraded: the picker's native 'change' event and the graph render
    // work regardless, and listeners attached before upgrade still fire afterwards.
    function boot() {
        init();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
}(document, window));
