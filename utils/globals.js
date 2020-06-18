/**
 * global variables and symbols
 */
"use strict";

module.exports = exports = {
	defaultBasePermission: 0, /*default permission that all clients are automatically assigned to*/
	permissionsKey: Symbol.for('permissions_property'), /*special key to get into the permissions when in the permission-tree nodes*/
	forceEventChangeKey: '__forceEventChangeKey'
};