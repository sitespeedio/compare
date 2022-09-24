/* global Chartist */
/* exported generateVisualProgress */

/**
 * We use Chartist to generate the visual progress
 * https: //gionkunz.github.io/chartist-js/
 * @param {*} visualProgress1
 * @param {*} visualProgress2
 * @param {*} id
 */

function generateVisualProgress(visualProgress1, visualProgress2, id) {
  let maxTime = 0;
  const series = [visualProgress1, visualProgress2].map((progressList) => {
    let previousProgress = -1;

    return Object.keys(progressList).reduce((coordinates, milliSecond) => {
      const currentProgress = progressList[milliSecond];
      if (currentProgress !== previousProgress) {
        previousProgress = currentProgress;
        const time = (Number(milliSecond) / 1000).toFixed(2);
        if (time > maxTime) {
          maxTime = time;
        }
        coordinates.push({
          x: time,
          y: currentProgress,
        });
      }
      return coordinates;
    }, []);
  });

  // let them end on the same spot.
  series[0].push({
    x: maxTime,
    y: 100,
  });

  series[1].push({
    x: maxTime,
    y: 100,
  });

  new Chartist.Line(
    '#' + id,
    {
      series,
    },
    {
      showArea: true,
      showPoint: true,
      chartPadding: {
        top: 10,
        right: 0,
        bottom: 30,
        left: 10,
      },
      axisX: {
        type: Chartist.AutoScaleAxis,
        onlyInteger: false,
        scaleMinSpace: 100,
        referenceValue: 1,
      },
      lineSmooth: Chartist.Interpolation.step({
        postpone: true,
        fillHoles: false,
      }),
      axisY: {
        onlyInteger: true,
      },
      plugins: [
        Chartist.plugins.ctAxisTitle({
          axisX: {
            axisTitle: 'Time (seconds)',
            axisClass: 'ct-axis-title',
            offset: {
              x: 0,
              y: 50,
            },
            textAnchor: 'middle',
          },
          axisY: {
            axisTitle: 'Visual progress %',
            axisClass: 'ct-axis-title',
            offset: {
              x: 0,
              y: -4,
            },
            textAnchor: 'middle',
            flipTitle: false,
          },
        }),
        Chartist.plugins.tooltip({
          transformTooltipTextFnc: function (text) {
            const m = text.split(',');
            return m[0] + 's ' + m[1] + '%';
          },
        }),
      ],
    }
  );
}
