/**
 * global variables and symbols
 */
"use strict";

module.exports = exports = {
	defaultBasePermission: 0, /*default permission that all clients are automatically assigned to*/
	permissionsKey: Symbol.for('permissions_property'), /*special key to get into the permissions when in the permission-tree nodes*/
	path2nodeKey: Symbol.for('path2node_property'), /*special key for the path-to-node map that is at the root of a PermissionTree*/
	forceEventChangeKey: '__forceEventChangeKey' /*key for forcing a change on the proxy. this will be used to run code inside the change-loop*/
};