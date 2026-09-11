/**
 * Работа с картой (OpenLayers).
 *
 * Библиотека грузится динамически и только когда карта действительно нужна:
 * иначе её ~600 КБ задерживали бы показ самого анонса тренировки.
 */
const DEPLOYMENT_COLOR = '#19ad6e';
const VENUE_COLOR = '#e54b4b';

let loading = null;

function injectOnce(tag, attributes) {
    return new Promise((resolve, reject) => {
        const element = Object.assign(document.createElement(tag), attributes);

        element.addEventListener('load', resolve, { once: true });
        element.addEventListener('error', reject, { once: true });

        document.head.append(element);
    });
}

export function loadOl() {
    if (window.ol) {
        return Promise.resolve(window.ol);
    }

    loading ??= Promise.all([
        injectOnce('link', { rel: 'stylesheet', href: 'vendor/ol.css' }),
        injectOnce('script', { src: 'vendor/ol.js' }),
    ]).then(() => {
        if (!window.ol) {
            throw new Error('OpenLayers не инициализировался.');
        }

        return window.ol;
    });

    return loading;
}

const coordinate = ({ lat, lng }) => window.ol.proj.fromLonLat([lng, lat]);

export function marker(location, kind) {
    return new window.ol.Feature({
        geometry: new window.ol.geom.Point(coordinate(location)),
        kind,
    });
}

/** Крестик: зелёный — точка сбора, красный — место тренировки. */
function markerStyle(feature) {
    const { ol } = window;

    return new ol.style.Style({
        text: new ol.style.Text({
            text: '✚',
            font: '700 32px system-ui, sans-serif',
            fill: new ol.style.Fill({
                color:
                    feature.get('kind') === 'deployment'
                        ? DEPLOYMENT_COLOR
                        : VENUE_COLOR,
            }),
            stroke: new ol.style.Stroke({ color: '#ffffff', width: 4 }),
            offsetY: -2,
        }),
    });
}

/**
 * Карта с двумя крестиками.
 * Возвращает { map, layer, tiles }, чтобы вызывающий код мог добавить
 * перетаскивание или подписаться на события загрузки тайлов.
 */
export function createMap(target, features, view) {
    const { ol } = window;

    const layer = new ol.layer.Vector({
        source: new ol.source.Vector({ features }),
        style: markerStyle,
    });

    const tiles = new ol.source.OSM();

    const map = new ol.Map({
        target,
        layers: [new ol.layer.Tile({ source: tiles }), layer],
        view: new ol.View({ center: coordinate(view), zoom: 16 }),
    });

    return { map, layer, tiles };
}

/** Показывает обе точки целиком, с отступами от краёв. */
export function fitBoth(map, first, second) {
    const extent = window.ol.extent.boundingExtent([
        coordinate(first),
        coordinate(second),
    ]);

    map.getView().fit(extent, {
        padding: [70, 70, 70, 70],
        maxZoom: 17,
        duration: 0,
    });
}

export function moveMarker(feature, location) {
    feature.getGeometry().setCoordinates(coordinate(location));
}

export function markerLocation(feature) {
    const [lng, lat] = window.ol.proj.toLonLat(
        feature.getGeometry().getCoordinates(),
    );

    return { lat, lng };
}

export function enableDragging(map, layer) {
    /*
     * Передаём слой, а не список features: Translate сам выбирает крестик
     * под курсором, поэтому тянется только тот, за который взялись.
     */
    map.addInteraction(new window.ol.interaction.Translate({ layers: [layer] }));
}
