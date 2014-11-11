'use strict';

angular.module('myApp', ['ui.router', 'mms', 'mms.directives', 'fa.directive.borderLayout', 'ui.bootstrap', 'ui.tree', 'angular-growl'])
.config(function($stateProvider, $urlRouterProvider) {
    $stateProvider
    .state('mm', {
        url: '',
        resolve: {
            workspaces: function(WorkspaceService) {
                return WorkspaceService.getWorkspaces();
            }
        },
        views: {
            'menu': {
                template: '<mms-nav mms-title="Model Manager" mms-ws="master"></mms-nav>'
            },
            'pane-center': {
                templateUrl: 'partials/mm/pane-center.html'
            },
            'pane-left': {
                templateUrl: 'partials/mm/pane-left.html',
                controller: 'WorkspaceTreeCtrl'
            },
            'pane-right': {
                templateUrl: 'partials/mm/pane-right.html'
            },
            'toolbar-right': {
                template: '<mms-toolbar buttons="buttons" on-click="onClick(button)" mms-tb-api="tbApi"></mms-toolbar>',
                controller: 'ToolbarCtrl'
            }            
        }
    })
    .state('mm.workspace', {
        url: '/workspace/:ws',
        resolve: {
            sites: function($stateParams, SiteService) {
                return SiteService.getSites($stateParams.ws);
            }
        },
        views: {
            'pane-center@': {
                templateUrl: 'partials/mm/pane-center.html',
                controller: function ($scope, $stateParams, sites) {
                    $scope.ws = $stateParams.ws;
                    $scope.sites = sites;
                    $scope.buttons = [];
                 }
            },
            'pane-right@': {
                templateUrl: 'partials/mm/pane-right.html',
                controller: function ($rootScope, $scope, $stateParams, sites) {
                    $scope.ws = $stateParams.ws;
                    $scope.sites = sites;
                    $scope.buttons = [];
                    $scope.element = $rootScope.treeApi.get_selected_branch().data;
                 }
            }
        }
    })
    .state('mm.diff', {
        url: '/diff/:source/:target',
        resolve: {
            diff: function($stateParams, WorkspaceService) {
                return WorkspaceService.diff($stateParams.source, $stateParams.target);
            }
        },
        views: {
            'pane-center@': {
                templateUrl: 'partials/mm/diff-pane-center.html'
            },
            'pane-left@': {
                templateUrl: 'partials/mm/diff-pane-left.html',
                controller: 'WorkspaceDiffChangeController'
            },
            'pane-right@': {
                templateUrl: 'partials/mm/diff-pane-right.html',
                controller: 'WorkspaceDiffTreeController'
            }
        }
    })
    .state('mm.diff.view', {
        url: '/element/:elementId',
        resolve: {
        },
        views: {
            'pane-center@': {
                templateUrl: 'partials/mm/diff-view-pane-center.html',
                controller: 'WorkspaceDiffElementViewController'
            }
        }
    });
});


