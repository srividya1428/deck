'use strict';

require('../app');
var angular = require('angular');

angular.module('deckApp')
  .controller('AllClustersCtrl', function($scope, application, _) {

    $scope.sortFilter = {
      allowSorting: true,
      sortPrimary: 'cluster',
      sortSecondary: 'region',
      filter: '',
      showAllInstances: true,
      hideHealthy: false
    };

    var sortOptions = [
      { label: 'Account', key: 'account' },
      { label: 'Cluster', key: 'cluster' },
      { label: 'Region', key: 'region' }
    ];

    $scope.sortOptions = function(exclude) {
      return exclude ?
        sortOptions.filter(function(option) { return option.key !== exclude; }) :
        sortOptions;
    };

    $scope.updateSorting = function() {
      var sortFilter = $scope.sortFilter;
      if (sortFilter.sortPrimary === sortFilter.sortSecondary) {
        sortFilter.sortSecondary = $scope.sortOptions(sortFilter.sortPrimary)[0].key;
      }
      $scope.updateClusterGroups();
    };

    function addSearchFields() {
      application.clusters.forEach(function(cluster) {
        cluster.serverGroups.forEach(function(serverGroup) {
          if (!serverGroup.searchField) {
            serverGroup.searchField = [
              serverGroup.region.toLowerCase(),
              serverGroup.name.toLowerCase(),
              serverGroup.account.toLowerCase(),
              _.collect(serverGroup.loadBalancers, 'name').join(' ')
            ].join(' ');
          }
        });
      });
    }

    function filterServerGroupsForDisplay(serverGroups, hideHealthy, filter) {
      return  _.chain(application.clusters)
        .collect('serverGroups')
        .flatten()
        .filter(function(serverGroup) {
          if (!filter) {
            return true;
          }
          return filter.split(' ').every(function(testWord) {
            return serverGroup.searchField.indexOf(testWord) !== -1;
          });
        })
        .filter(function(serverGroup) {
          if (hideHealthy) {
            return serverGroup.downCount > 0;
          }
          return true;
        })
        .value();
    }

    function incrementTotalInstancesDisplayed(totalInstancesDisplayed, serverGroups) {
      if (!$scope.sortFilter.hideHealthy) {
        totalInstancesDisplayed += serverGroups.reduce(function (total, serverGroup) {
          return serverGroup.asg.instances.length + total;
        }, 0);
      } else {
        totalInstancesDisplayed += serverGroups.reduce(function (total, serverGroup) {
          return (serverGroup.asg.downCount > 0 ? serverGroup.asg.instances.length : 0) + total;
        }, 0);
      }
      return totalInstancesDisplayed;
    }

    function updateClusterGroups() {
      var groups = [],
        totalInstancesDisplayed = 0,
        filter = $scope.sortFilter.filter.toLowerCase(),
        primarySort = $scope.sortFilter.sortPrimary,
        secondarySort = $scope.sortFilter.sortSecondary,
        tertiarySort = sortOptions.filter(function(option) { return option.key !== primarySort && option.key !== secondarySort; })[0].key;

      var serverGroups = filterServerGroupsForDisplay(application.serverGroups, $scope.sortFilter.hideHealthy, filter);

      var grouped = _.groupBy(serverGroups, primarySort);

      _.forOwn(grouped, function(group, key) {
        var subGroupings = _.groupBy(group, secondarySort),
          subGroups = [];

        _.forOwn(subGroupings, function(subGroup, subKey) {
          var subGroupings = _.groupBy(subGroup, tertiarySort),
            subSubGroups = [];

          _.forOwn(subGroupings, function(subSubGroup, subSubKey) {
            totalInstancesDisplayed = incrementTotalInstancesDisplayed(totalInstancesDisplayed, subSubGroup);
            subSubGroups.push( { heading: subSubKey, serverGroups: subSubGroup } );
          });
          subGroups.push( { heading: subKey, subgroups: _.sortBy(subSubGroups, 'heading') } );
        });

        groups.push( { heading: key, subgroups: _.sortBy(subGroups, 'heading') } );
      });

      $scope.groups = _.sortBy(groups, 'heading');

      $scope.displayOptions = {
        renderInstancesOnScroll: totalInstancesDisplayed > 2000, // TODO: move to config
        showInstances: $scope.sortFilter.showAllInstances,
        hideHealthy: $scope.sortFilter.hideHealthy
      };

      $scope.$digest(); // downside of debouncing

    }

    $scope.updateClusterGroups = _.debounce(updateClusterGroups, 200);

    addSearchFields();
    $scope.updateClusterGroups();
    $scope.clustersLoaded = true;

  }
);
