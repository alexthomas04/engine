/**
 * Created by Sonicdeadlock on 3/1/2016.
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
    $rootScope
        .$on('$stateChangeSuccess',
            function (event) {

                if (!$window.ga)
                    return;

                $window.ga('send', 'pageview', {page: $location.path()});
            });

}]);
app.config(['$stateProvider', '$urlRouterProvider', function ($stateProvider, $urlRouterProvider) {
    $urlRouterProvider.otherwise('/');

    $stateProvider
        .state('home', {
            url: '/',
            views: {
                navbar: {
                    templateUrl: "components/navbar/navbarView.html",
                    controller: "navbarController"
                },
                content: {
                    templateUrl: "components/home/homeView.html",
                    controller: "homeController"
                }
            }
        })
        .state('remove_character', {
            url: '/remove_character',
            views: {
                navbar: {
                    templateUrl: "components/navbar/navbarView.html",
                    controller: 'navbarController'
                },
                content: {
                    templateUrl: "components/remove_character/remove_characterView.html",
                    controller: "remove_characterController"
                }
            }
        })
        .state('replace_character', {
            url: '/replace_character',
            views: {
                navbar: {
                    templateUrl: "components/navbar/navbarView.html",
                    controller: 'navbarController'
                },
                content: {
                    templateUrl: "components/replace_character/replace_characterView.html",
                    controller: "replace_characterController"
                }
            }
        })
        .state('image', {
            url: "/image",
            views: {
                navbar: {
                    templateUrl: 'components/navbar/navbarView.html',
                    controller: 'navbarController'
                },
                content: {
                    templateUrl: 'components/image/imageView.html',
                    controller: 'image_controller'
                }
            }
        });
}]);

angular.module('controllers', ['ngAnimate', 'mgcrea.ngStrap', 'ngCookies', 'ngFileUpload']);
angular.module('directives', ['ngAnimate', 'mgcrea.ngStrap']);
angular.module('services', []);