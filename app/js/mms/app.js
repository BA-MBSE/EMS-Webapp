'use strict';


angular.module('mmsApp', ['mms', 'mms.directives', 'app.tpls', 'fa.directive.borderLayout', 'ui.bootstrap', 'ui.router', 'ui.tree', 'angular-growl', 'cfp.hotkeys', 'angulartics', 'angulartics.piwik', 'diff-match-patch', 'ngStorage', 'ngCookies'])
.config(function($stateProvider, $urlRouterProvider, $httpProvider) {

    
    $urlRouterProvider.rule(function ($injector, $location) {
        var locationPath = $location.url();
        if (locationPath.indexOf('full%23') > 0)
            locationPath = locationPath.replace('full%23', 'full#');
        if (locationPath[0] !== '/')
            locationPath = '/' + locationPath;
        if (locationPath[locationPath.length-1] == '/')
            locationPath = locationPath.substring(0, locationPath.length-1);
        if (locationPath !== $location.url())
            $location.url(locationPath);
     });

    $httpProvider.defaults.withCredentials = true;
// Check if user is logged in, if so redirect to select page otherwise go to login if the url isn't mapped
    $urlRouterProvider.otherwise(function($injector, $location) {
        var $rootScope = $injector.get('$rootScope');
        if ($location.url().includes('workspace')) {
            $rootScope.redirect_from_old_site = true;
        } else {
            $rootScope.redirect_from_old_site = false;
        }
        var $state = $injector.get('$state');
        var checkLogin = $injector.get('AuthService').checkLogin();
        if (checkLogin) {
            $state.go('login.select');
        } else {
            $state.go('login');
        }
    });

    $stateProvider
    .state('login', {
        url: '/login',
        resolve: { },
        views: {
            'login@': {
                templateUrl: 'partials/mms/login.html',
                controller: function ($scope, $rootScope, $state, AuthService, growl) {
                    $scope.credentials = {
                      username: '',
                      password: ''
                    };
                    $rootScope.ve_title = 'View Editor';
                    $scope.spin = false;
                    $scope.login = function (credentials) {
                        $scope.spin = true;
                        var credentialsJSON = {"username":credentials.username, "password":credentials.password};
                        AuthService.getAuthorized(credentialsJSON)
                        .then(function(user) {
                            if ($rootScope.ve_redirect) {
                                var toState = $rootScope.ve_redirect.toState;
                                var toParams = $rootScope.ve_redirect.toParams;
                                $state.go(toState, toParams);
                            } else {
                                $state.go('login.select');
                            }
                        }, function (reason) {
                            $scope.spin = false;
                            growl.error(reason.message);
                        });
                    };
                }   
            }
        }
    })
    .state('login.select', {
        url: '/select',
        resolve: {
            ticket: function($window, URLService, AuthService, $q, $http, $cookies, growl, ApplicationService) {
                var deferred = $q.defer();
                AuthService.checkLogin().then(function(data) {
                    ApplicationService.setUserName(data);
                    URLService.setTicket($window.localStorage.getItem('ticket'));
                    deferred.resolve($window.localStorage.getItem('ticket'));
                    $http.post('/Basic/mms/cookieAuth?op=Sign In&username='+data).then(
                        function(data2){
                            $cookies.put('com.tomsawyer.web.license.user', data);
                        }, function(reason) {
                            growl.error("TSP license can not be activated: " + reason.message);
                        }
                    );
                }, function(rejection) {
                    deferred.reject(rejection);
                });
                return deferred.promise;
            },
            orgObs: function($stateParams, ProjectService, ticket) { 
                return ProjectService.getOrgs();
            }
        },
        views: {
            'login@': {
                templateUrl: 'partials/mms/select.html',
                controller: function($scope, $rootScope, $state, orgObs, ProjectService, AuthService, growl, $localStorage) {
                    $rootScope.ve_title = 'View Editor'; //what to name this?
                    $localStorage.$default({org: orgObs[0]});
                    $scope.spin = false;
                    $scope.orgs = orgObs;
                    var orgId, projectId;
                    $scope.selectOrg = function(org) {
                        if (org) {
                            $localStorage.org = org;
                            orgId = org.id;
                            $localStorage.org.orgName = org.name;
                            $scope.selectedOrg = $localStorage.org.name;
                            $scope.selectedProject = ""; // default here?
                            ProjectService.getProjects(orgId).then(function(data){
                                $scope.projects = data;
                                if (data.length > 0) {
                                    if($localStorage.project && checkForProject(data, $localStorage.project) === 1){
                                        $scope.selectedProject = $localStorage.project.name;
                                        projectId = $localStorage.project.id;
                                    }else{
                                        $scope.selectProject(data[0]);
                                    }
                                }
                            });
                        }
                    };
                    $scope.selectProject = function(project) {
                        if (project) {
                            $localStorage.project = project;
                            $scope.selectedProject = $localStorage.project.name;
                            projectId = $localStorage.project.id;
                        }
                    };
                    if ($localStorage.org) {
                        $scope.selectOrg($localStorage.org);
                    }
                    var checkForProject = function(projectArray, project) {
                        for (var i = 0; i < projectArray.length; i++) {
                            if(projectArray[i].id === project.id){
                                return 1;
                            } 
                        }
                        return 0;
                    };
                    
                    $scope.continue = function() {
                        if (orgId && projectId) {
                            $scope.spin = true;
                            $rootScope.redirect_from_old_site = false;
                            $state.go('project.ref', {orgId: orgId, projectId: projectId, refId: 'master'}).then(function(data) {
                            }, function(reject) {
                                $scope.spin = false;
                            });
                        }
                    };
                    $scope.logout = function() {
                        AuthService.logout().then(function() {
                            $state.go('login');
                        }, function() {
                            growl.error('You were not logged out');
                        });
                    };
                }
            }
        }
    })
    .state('project', { //TODO this will be the ui to diff and merge and manage refs
        url: '/projects/:projectId',
        resolve: {
            ticket: function($window, URLService, AuthService, $q, ApplicationService) {
                var deferred = $q.defer();
                AuthService.checkLogin().then(function(data) {
                    ApplicationService.setUserName(data);
                    URLService.setTicket($window.localStorage.getItem('ticket'));
                    deferred.resolve($window.localStorage.getItem('ticket'));
                }, function(rejection) {
                    deferred.reject(rejection);
                });
                return deferred.promise;
            },
            orgObs: function($stateParams, ProjectService, ticket) {
                return ProjectService.getOrgs();
            },
            projectOb: function($stateParams, ProjectService, ticket) {
                return ProjectService.getProject($stateParams.projectId);
            },
            projectObs: function($stateParams, ProjectService, ticket, projectOb) {
                return ProjectService.getProjects(projectOb.orgId);
            },
            orgOb: function(ProjectService, projectOb, ticket) {
                return ProjectService.getOrg(projectOb.orgId);
            },
            refObs: function($stateParams, ProjectService, ticket) {
                return ProjectService.getRefs($stateParams.projectId);
            },
            tagObs: function(refObs) {
                var ret = [];
                for (var i = 0; i < refObs.length; i++) {
                    if (refObs[i].type === "Tag")
                        ret.push(refObs[i]);
                }
                return ret;
            },
            branchObs: function(refObs) {
                var ret = [];
                for (var i = 0; i < refObs.length; i++) {
                    if (refObs[i].type === "Branch")
                        ret.push(refObs[i]);
                }
                return ret;
            },
            refOb: function() { return null;},
            tagOb: function() { return null;},
            branchOb: function() { return null;},
            documentOb: function(){ return null;},
            viewOb: function(){ return null;},
            search: function(){ return null;}
        },
        views: {
            'nav@': {
                template: '<ve-nav mms-title="ve_title" mms-org="org" mms-orgs="orgs" mms-project="project" mms-projects="projects" mms-ref="ref" mms-branch="branch" mms-branches="branches" mms-tag="tag" mms-tags="tags" mms-search="search"></ve-nav>', 
                controller: function ($scope, $rootScope, orgOb, orgObs, projectOb, projectObs, refOb, branchOb, branchObs, tagOb, tagObs, search) {
                    $rootScope.ve_title = orgOb.name;
                    $scope.org = orgOb;
                    $scope.orgs = orgObs;
                    $scope.project = projectOb;
                    $scope.projects = projectObs;
                    $scope.ref = refOb;
                    $scope.branch = branchOb;
                    $scope.branches = branchObs;
                    $scope.tag = tagOb;
                    $scope.tags = tagObs;
                    $scope.search = search;
                }
            },
            'menu@': {
                template: '<ve-menu mms-title="ve_title" mms-org="org" mms-project="project" mms-projects="projects" mms-ref="ref" mms-refs="refs" mms-branch="branch" mms-branches="branches" mms-tag="tag" mms-tags="tags"></ve-menu>',
                controller: function ($scope, $rootScope, orgOb, projectOb, projectObs, refOb, refObs, branchOb, branchObs, tagOb, tagObs) {
                    $rootScope.ve_title = orgOb.name;
                    $scope.org = orgOb;
                    $scope.project = projectOb;
                    $scope.projects = projectObs;
                    $scope.ref = refOb;
                    $scope.refs = refObs;
                    $scope.branch = branchOb;
                    $scope.branches = branchObs;
                    $scope.tag = tagOb;
                    $scope.tags = tagObs;
                }
            },
            'manageRefs@': {
                templateUrl: 'partials/mms/manage-refs.html',
                controller: 'RefsCtrl'
            }
        }
    })
    .state('project.ref', { //equivalent to old sites and documents page
        url: '/:refId?search',
        resolve: {
            projectOb: function($stateParams, ProjectService, ticket) {
                return ProjectService.getProjectMounts($stateParams.projectId, $stateParams.refId);
            },
            refOb: function($stateParams, ProjectService, ticket) {
                return ProjectService.getRef($stateParams.refId, $stateParams.projectId);
            },
            tagOb: function(refOb) {
                if(refOb.type === "Tag")
                    return refOb;
                else {
                    return [];
                }
            },
            branchOb: function(refOb) {
                if(refOb.type === "Branch")
                    return refOb;
                else {
                    return [];
                }
            },
            groupObs: function($stateParams, ProjectService, ticket) {
                return ProjectService.getGroups($stateParams.projectId, $stateParams.refId);
            },
            documentOb: function($stateParams, $q, ElementService, ViewService, refOb, projectOb, ticket) {
                var deferred = $q.defer();
                var eid = $stateParams.projectId + '_cover';
                ElementService.getElement({
                    projectId: $stateParams.projectId,
                    refId: $stateParams.refId,
                    extended: true,
                    elementId: eid
                }, 2).then(function(data) {
                    deferred.resolve(data);
                }, function(reason) {
                    if (reason.status === 404) {
                        if (refOb.type === 'Tag') {
                            deferred.resolve(null);
                        } else {
                            ViewService.createView({
                                _projectId: $stateParams.projectId, 
                                _refId: $stateParams.refId,
                                id: 'holding_bin_' + $stateParams.projectId
                            },{
                                viewName: projectOb.name + ' Cover Page', 
                                viewId: eid
                            }, 2).then(function(data) {
                                deferred.resolve(data);
                            }, function(reason2) {
                                deferred.resolve(null);
                            });
                        }
                    } else {
                        deferred.reject(reason);
                    }
                });
                return deferred.promise;
            },
            viewOb: function(documentOb) {
                return documentOb;
            },
            search: function($stateParams, ElementService, ticket) {
                if ($stateParams.search === undefined) {
                    return null;
                }
                return $stateParams.search;
            }
        },
        views: {
            'nav@': {
                template: '<ve-nav mms-title="ve_title" mms-org="org" mms-orgs="orgs" mms-project="project" mms-projects="projects" mms-ref="ref" mms-branch="branch" mms-branches="branches" mms-tag="tag" mms-tags="tags" mms-search="search"></ve-nav>', 
                controller: function ($scope, $rootScope, orgOb, orgObs, projectOb, projectObs, refOb, branchOb, branchObs, tagOb, tagObs, search) {
                    $rootScope.ve_title = orgOb.name;
                    $scope.org = orgOb;
                    $scope.orgs = orgObs;
                    $scope.project = projectOb;
                    $scope.projects = projectObs;
                    $scope.ref = refOb;
                    $scope.branch = branchOb;
                    $scope.branches = branchObs;
                    $scope.tag = tagOb;
                    $scope.tags = tagObs;
                    $scope.search = search;
                }
            },
            'menu@': {
                template: '<ve-menu mms-title="ve_title" mms-org="org" mms-ref="ref" mms-refs="refs" mms-groups="groups" mms-project="project" mms-projects="projects" mms-branch="branch" mms-branches="branches" mms-tag="tag" mms-tags="tags"></ve-menu>',
                controller: function ($scope, $rootScope, orgOb, groupObs, projectOb, projectObs, refOb, refObs, branchOb, branchObs, tagOb, tagObs) {
                    $rootScope.ve_title = orgOb.name;
                    $scope.org = orgOb;
                    $scope.groups = groupObs;
                    $scope.project = projectOb;
                    $scope.projects = projectObs;
                    $scope.ref = refOb;
                    $scope.refs = refObs;
                    $scope.branch = branchOb;
                    $scope.branches = branchObs;
                    $scope.tag = tagOb;
                    $scope.tags = tagObs;
                }
            },
            'pane-left@': {
                templateUrl: 'partials/mms/pane-left.html',
                controller: 'TreeCtrl'
            },
            'pane-center@': {
                templateUrl: 'partials/mms/pane-center.html',
                controller: 'ViewCtrl'
            },
            'pane-right@': {
                templateUrl: 'partials/mms/pane-right.html',
                controller: 'ToolCtrl'
            },
            'toolbar-right@': {
                template: '<mms-toolbar buttons="buttons" on-click="onClick(button)" mms-tb-api="tbApi"></mms-toolbar>',
                controller: 'ToolbarCtrl'
            } 
        }
    })
    .state('project.ref.manage', { //not needed right now, for managing mounts
        url: '/manage'
    })
    .state('project.ref.preview', {
        url: '/document/:documentId',
        resolve: {
            documentOb: function($stateParams, $q, ElementService, ViewService, refOb, ticket) {
                var deferred = $q.defer();
                var eid = $stateParams.documentId;
                var coverIndex = eid.indexOf('_cover');
                if (coverIndex > 0) {
                    var groupId = eid.substring(5, coverIndex);
                    ElementService.getElement({
                        projectId: $stateParams.projectId,
                        refId: $stateParams.refId,
                        extended: true,
                        elementId: eid
                    }, 2).then(function(data) {
                        deferred.resolve(data);
                    }, function(reason) {
                        if (reason.status === 404) {
                            if (refOb.type === 'Tag') {
                                deferred.resolve(null);
                            } else {
                                ElementService.getElement({projectId: $stateParams.projectId, refId: $stateParams.refId, elementId: groupId})
                                .then(function(groupElement) {
                                    ViewService.createView({
                                        _projectId: $stateParams.projectId, 
                                        _refId: $stateParams.refId,
                                        id: groupId
                                    },{
                                        viewName: groupElement.name + ' Cover Page', 
                                        viewId: eid
                                    }, 2)
                                    .then(function(data) {
                                        deferred.resolve(data);
                                    }, function(reason3) {
                                        deferred.resolve(null);
                                    });
                                }, function(reason2) {
                                    deferred.resolve(null);
                                });
                            }
                        } else {
                            deferred.reject(reason);
                        }
                    });
                } else {
                    ElementService.getElement({
                        projectId: $stateParams.projectId,
                        refId: $stateParams.refId,
                        extended: true,
                        elementId: $stateParams.documentId
                    }, 2).then(function(data){
                        deferred.resolve(data);
                    }, function(reason) {
                        deferred.reject(reason);
                    });
                }
                return deferred.promise;
            },
            viewOb: function(documentOb) {
                return documentOb;
            },
            groupOb: function(groupObs, documentOb, ProjectService, ticket) {
                var group = null;
                if(documentOb) {
                    for(var i = 0; i < groupObs.length; i++) {
                        if(groupObs[i]._id == documentOb._groupId) {
                            group = groupObs[i];
                            break;
                        }
                    }
                }
                return group;
            }
        },
        views: {
            'menu@': {
                template: '<ve-menu mms-title="ve_title" mms-org="org" mms-ref="ref" mms-refs="refs" mms-group="group" mms-groups="groups" mms-project="project" mms-projects="projects" mms-branch="branch" mms-branches="branches" mms-tag="tag" mms-tags="tags"></ve-menu>',
                controller: function ($scope, $rootScope, orgOb, groupOb, groupObs, projectOb, projectObs, refOb, refObs, branchOb, branchObs, tagOb, tagObs) {
                    $rootScope.ve_title = orgOb.name;
                    $scope.org = orgOb;
                    $scope.ref = refOb;
                    $scope.group = groupOb;
                    $scope.groups = groupObs;
                    $scope.project = projectOb;
                    $scope.projects = projectObs;
                    $scope.ref = refOb;
                    $scope.refs = refObs;
                    $scope.branch = branchOb;
                    $scope.branches = branchObs;
                    $scope.tag = tagOb;
                    $scope.tags = tagObs;
                }
            },
            'pane-center@': {
                templateUrl: 'partials/mms/pane-center.html',
                controller: 'ViewCtrl'
            },
            'pane-right@': {
                templateUrl: 'partials/mms/pane-right.html',
                controller: 'ToolCtrl'
            }
        }
    })
    .state('project.ref.document', {
        url: '/documents/:documentId', 
        resolve: {
            documentOb: function($stateParams, ElementService, ticket) {
                return ElementService.getElement({
                    projectId: $stateParams.projectId,
                    refId: $stateParams.refId,
                    extended: true,
                    elementId: $stateParams.documentId
                }, 2);
            },
            viewOb: function(documentOb) {
                return documentOb;
            },
            groupOb: function(groupObs, documentOb, ProjectService, ticket) {
            var group = null;
            if(documentOb) {
                for(var i = 0; i < groupObs.length; i++) {
                    if(groupObs[i]._id == documentOb._groupId) {
                        group = groupObs[i];
                        break;
                    }
                }
            }
            return group;
            }
        },
        views: {
            'menu@': {
                template: '<ve-menu mms-title="ve_title" mms-org="org" mms-ref="ref" mms-refs="refs" mms-group="group" mms-groups="groups" mms-project="project" mms-projects="projects" mms-branch="branch" mms-branches="branches" mms-tag="tag" mms-tags="tags" mms-document="document"></ve-menu>',
                controller: function ($scope, $rootScope, orgOb, groupOb, groupObs, projectOb, projectObs, refOb, refObs, branchOb, branchObs, tagOb, tagObs, documentOb) {
                    $rootScope.ve_title = orgOb.name;
                    $scope.org = orgOb;
                    $scope.group = groupOb;
                    $scope.groups = groupObs;
                    $scope.project = projectOb;
                    $scope.projects = projectObs;
                    $scope.ref = refOb;
                    $scope.refs = refObs;
                    $scope.branch = branchOb;
                    $scope.branches = branchObs;
                    $scope.tag = tagOb;
                    $scope.tags = tagObs;
                    $scope.document = documentOb;
                }
            },
            'pane-left@': {
                templateUrl: 'partials/mms/pane-left.html',
                controller: 'TreeCtrl'
            },          
            'pane-center@': {
                templateUrl: 'partials/mms/pane-center.html',
                controller: 'ViewCtrl'
            },
            'pane-right@': {
                templateUrl: 'partials/mms/pane-right.html',
                controller: 'ToolCtrl'
            },
            'toolbar-right@': {
                template: '<mms-toolbar buttons="buttons" on-click="onClick(button)" mms-tb-api="tbApi"></mms-toolbar>',
                controller: 'ToolbarCtrl'
            }
        }
    })
    .state('project.ref.document.view', {
        url: '/views/:viewId',
        resolve: {
            viewOb: function($stateParams, ElementService, ticket) {
                return ElementService.getElement({
                    projectId: $stateParams.projectId,
                    refId: $stateParams.refId,
                    elementId: $stateParams.viewId
                }, 2);
            },
            groupOb: function(groupObs, documentOb, ProjectService, ticket) {
                var group = null;
                if(documentOb) {
                    for(var i = 0; i < groupObs.length; i++) {
                        if(groupObs[i]._id == documentOb._groupId) {
                            group = groupObs[i];
                            break;
                        }
                    }
                }
                return group;
            }
        },
        views: {
            'menu@': {
                template: '<ve-menu mms-title="ve_title" mms-org="org" mms-group="group" mms-groups="groups" mms-project="project" mms-projects="projects" mms-ref="ref" mms-refs="refs" mms-branch="branch" mms-branches="branches" mms-tag="tag" mms-tags="tags" mms-document="document"></ve-menu>',
                controller: function ($scope, $rootScope, orgOb, groupOb, groupObs, projectOb, projectObs, refOb, refObs, branchOb, branchObs, tagOb, tagObs, documentOb) {
                    $rootScope.ve_title = orgOb.name;
                    $scope.org = orgOb;
                    $scope.group = groupOb;
                    $scope.groups = groupObs;
                    $scope.project = projectOb;
                    $scope.projects = projectObs;
                    $scope.ref = refOb;
                    $scope.refs = refObs;
                    $scope.branch = branchOb;
                    $scope.branches = branchObs;
                    $scope.tag = tagOb;
                    $scope.tags = tagObs;
                    $scope.document = documentOb;
                }
            },
            'pane-center@': {
                templateUrl: 'partials/mms/pane-center.html',
                controller: 'ViewCtrl'
            }
        }
    })
    .state('project.ref.document.order', {
        url: '/order',
        views: {      
            'pane-center@': {
                templateUrl: 'partials/mms/reorder-views.html',
                controller: 'ReorderCtrl'
            }
        }
    })
    .state('project.ref.document.full', {
        url: '/full',
        views: {      
            'pane-center@': {
                templateUrl: 'partials/mms/full-doc.html',
                controller: 'FullDocCtrl'
            }
        }
    });

    // anonymous factory intercepts requests
    $httpProvider.interceptors.push(function($q, $location, $rootScope, $injector) {
        return {
            'responseError': function(rejection) {
                if(rejection.status === 401){ //rejection.config.url
                    $rootScope.$broadcast("mms.unauthorized", rejection); 
                }
                return $q.reject(rejection);
            },
            response: function(response) {
                if (response.status === 202) {
                    $rootScope.$broadcast("mms.working", response);
                }
                response.status = 501;
                return response;
            }
        };
    });
});
