import { View, Utils } from '@nativescript/core'
const sdk = () => (org as any).maplibre.android

export class NativeMapDemo extends View {
  map: any
  marker: any
  private ready: (() => void)[] = []
  createNativeView() {
    const api = sdk()
    api.MapLibre.getInstance(this._context)
    return new api.maps.MapView(this._context)
  }
  initNativeView() {
    super.initNativeView()
    const view = this.nativeViewProtected,
      api = sdk()
    view.onCreate(null)
    view.onStart()
    view.onResume()
    view.getMapAsync(
      new api.maps.OnMapReadyCallback({
        onMapReady: (map: any) => {
          this.map = map
          map.getUiSettings().setAllGesturesEnabled(false)
          const style = {
            version: 8,
            sources: {
              osm: {
                type: 'raster',
                tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                tileSize: 256,
                attribution: '© OpenStreetMap contributors',
              },
            },
            layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
          }
          map.setStyle(
            new api.maps.Style.Builder().fromJson(JSON.stringify(style)),
            new api.maps.Style.OnStyleLoaded({
              onStyleLoaded: () => {
                map.moveCamera(
                  api.camera.CameraUpdateFactory.newLatLngZoom(
                    new api.geometry.LatLng(37.776, -122.419),
                    14,
                  ),
                )
                this.marker = map.addMarker(
                  new api.annotations.MarkerOptions()
                    .position(new api.geometry.LatLng(37.772, -122.423))
                    .title('Jolt car'),
                )
                for (const callback of this.ready) callback()
                this.ready = []
              },
            }),
          )
        },
      }),
    )
  }
  whenReady(callback: () => void) {
    if (this.marker) callback()
    else this.ready.push(callback)
  }
  disposeNativeView() {
    this.ready = []
    this.map = this.marker = undefined
    this.nativeViewProtected.onPause()
    this.nativeViewProtected.onStop()
    this.nativeViewProtected.onDestroy()
    super.disposeNativeView()
  }
}
export class NativeSceneDemo extends View {
  camera: any
  createNativeView() {
    const label = new android.widget.TextView(this._context)
    label.setText(
      'SceneKit camera adapter is available on iOS.\nAndroid renderers can implement PropertySink.',
    )
    label.setGravity(android.view.Gravity.CENTER)
    label.setTextColor(android.graphics.Color.WHITE)
    return label
  }
}
