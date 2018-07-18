'use strict';

angular.module('mms.directives')
    .directive('mmsHtmlDiff', ['$templateCache', '$timeout', 'MathJax', 'HtmlRenderedDiff', mmsHtmlDiff]);

function mmsHtmlDiff($templateCache, $timeout, MathJax, HtmlRenderedDiff) {
    var template = $templateCache.get('mms/templates/mmsHtmlDiff.html');
    var htmlDiffIdPrefix = 'htmlDiff-';
    return {
        restrict: 'E',
        scope: {
            mmsBaseHtml: '<',
            mmsComparedHtml: '<',
            mmsDiffFinish: '<'
        },
        template: template,
        controller: ['$scope', mmsHtmlDiffCtrl],
        link: mmsHtmlDiffLink
    };

    function mmsHtmlDiffCtrl($scope) {
        performDiff($scope, $scope.mmsBaseHtml, $scope.mmsComparedHtml);
    }

    function mmsHtmlDiffLink(scope, element, attrs) {
        scope.htmlDiffId = htmlDiffIdPrefix + scope.$id;
        scope.$watch('mmsBaseHtml', function(newBaseHtml, oldBaseHtml) {
            if (newBaseHtml !== oldBaseHtml) {
                performDiff(scope, scope.mmsBaseHtml, scope.mmsComparedHtml);
            }
        });

        scope.$watch('mmsComparedHtml', function(newComparedHtml, oldComparedHtml) {
            if(newComparedHtml !== oldComparedHtml) {
                performDiff(scope, scope.mmsBaseHtml, scope.mmsComparedHtml);
            }
        });
    }

    function performDiff(scope, baseHtml, comparedHtml) {
        baseHtml = baseHtml.replace(/\r?\n|\r/g, '');
        comparedHtml = comparedHtml.replace(/\r?\n|\r/g, '');
        var diffResult = HtmlRenderedDiff.generateDiff(baseHtml, comparedHtml);
        // still need to run math stuff to render it properly
        // if (MathJax) {
        //     MathJax.Hub.Queue(["Typeset", MathJax.Hub, domElement[0]]);
        // }
        scope.diffResult = diffResult;
        $timeout(function() {
            var diffContainer = $('#' + scope.htmlDiffId);
            formatImgDiff(diffContainer);
            formatRowDiff(diffContainer);
            formatEquationDiff(diffContainer);
            scope.mmsDiffFinish();
        });
    }

    function formatImgDiff(diffContainer) {
        diffContainer.find('img')
            .each(function () {
                var img$ = $(this);
                var imgPatcherClass = img$.hasClass('patcher-insert') ? 'patcher-insert' : img$.hasClass('patcher-delete') ? 'patcher-delete' : null;
                if (imgPatcherClass) {
                    img$.wrap('<span class="' + imgPatcherClass + '">');
                }
            });
    }

    function formatRowDiff(diffContainer) {
        diffContainer.find('tr')
            .each(function () {
                var tr$ = $(this);
                var trPatcherClass = tr$.hasClass('patcher-insert') ? 'patcher-insert' : tr$.hasClass('patcher-delete') ? 'patcher-delete' : null;
                if (trPatcherClass) {
                   tr$.removeClass(trPatcherClass);
                   tr$.children().each(function() {
                       $(this).addClass(trPatcherClass);
                   });
                }
            });
    }

    function formatEquationDiff(diffContainer) {
        if (MathJax) {
            MathJax.Hub.Queue(["Typeset", MathJax.Hub, diffContainer[0]]);
        }
    }
}
