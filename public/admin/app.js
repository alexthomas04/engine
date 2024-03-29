/**
 * Created by Sonicdeadlock on 7/21/2015.
 */
'use strict';

var app = angular.module('userApp', [
    'ngResource',
    'ui.router',
    'controllers',
    'services',
    'directives',
    'ngSanitize'
]);
app.run(['$rootScope', '$state', '$stateParams', '$http', '$window', '$location', function ($rootScope, $state, $stateParams, $http, $window, $location) {
    $rootScope.$on("$stateChangeError", console.log.bind(console));

    //Save a copy of the parameters so we can access them from all the controllers
    $rootScope.$state = $state;
    $rootScope.$stateParams = $stateParams;
    $http.get('/auth/self').success(function (data) {
        $rootScope.logged_in_user = data;


    });
    $rootScope
        .$on('$stateChangeSuccess',
            function (event) {
                if (!$window.ga)
                    return;
                $window.ga('send', 'pageview', {page: $location.path()});
            });
    $rootScope.hasPermission = function (perm) {
        var user = $rootScope.logged_in_user;
        if (!user || !user.group || !user.group.permissions) return false;
        var permissions = user.group.permissions;
        if (permissions.indexOf('god') != -1 || permissions.indexOf('sudo') != -1) return true;
        if (permissions.indexOf(perm) != -1) return true;
        return false;
    }
}]);
app.config(['$stateProvider', '$urlRouterProvider', function ($stateProvider, $urlRouterProvider) {
    $urlRouterProvider.otherwise('/user');

    $stateProvider
        .state('user', {
            url: '/user',
            views: {
                navbar: {
                    templateUrl: "components/navbar/navbarView.html",
                    controller: "navbarController"
                },
                content: {
                    templateUrl: "/user/components/manage/manageView.html",
                    controller: "manageController"
                }
            }
        })
        .state('room', {
            url: '/room',
            views: {
                navbar: {
                    templateUrl: "components/navbar/navbarView.html",
                    controller: "navbarController"
                },
                content: {
                    templateUrl: "components/room/roomView.html",
                    controller: "roomController"
                }
            }
        })
        .state('update_notes', {
            url: '/update_notes',
            views: {
                navbar: {
                    templateUrl: "components/navbar/navbarView.html",
                    controller: "navbarController"
                },
                content: {
                    templateUrl: "components/updateNotes/updateNotesAdminView.html",
                    controller: "updateNotesController"
                }
            }
        })
}]);
app.factory('socket', function () {
    return _.noop;
});
angular.module('controllers', ['ngAnimate', 'mgcrea.ngStrap']);
angular.module('directives', ['ngAnimate', 'mgcrea.ngStrap']);
angular.module('services', []);