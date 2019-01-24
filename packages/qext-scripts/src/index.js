const program = require('commander')
const fs = require("fs-extra")
import { from, Subject, combineLatest, of, iif } from 'rxjs'
import { map, withLatestFrom, share, tap, switchMap, mergeMap, filter } from 'rxjs/operators'
import { 
  copyQext, 
  copyStatic, 
  copySrc,
  defineWebpack,
  build,
  zip,
  uploadExtension,
  authenticate
} from './components/component-exports'

program
  .option('-b, --webpack-build', 'Build with Webpack')
  .option('-w, --webpack-watch', 'Watch with Webpack')
  .option('-d, --deploy-server', 'Deploy to Server')
  .parse(process.argv)


/* Create cookie jar to store cookies for any future
    uploads */
const cookieJar$ = new Subject()

/* Initialize authentication */
const initialAuthenticate$ = authenticate(cookieJar$).pipe(
  tap(auth => console.log(`${auth.message}\n`))
)


/* Get extension name from .qext file */
const extensionName = fs.readdir(`${process.cwd()}/src`)
  .then(ext => ext
    .filter(file => file.indexOf('.qext') > -1)
    [0].split('.qext')[0]
  )


const extension$ = of(program.deployServer).pipe(
  mergeMap(deployServer => iif(
    /* if deployServer flag set.. */
    () => deployServer,

    /* prompt for user authentication */
    initialAuthenticate$.pipe(
      switchMap(() => from(extensionName))
    ),

    /* otherwise, skip authentication */
    from(extensionName)
  )),
  tap(extension => console.log(`\nconnecting project ${extension}\n`)),
  share(1)
)


// Copy qext
const copyQext$ = extension$.pipe(
  /* Only copy Qext if we are bundling with webpack */
  filter(() => program.webpackBuild || program.webpackWatch),
  copyQext(),
  tap(qextStatus => console.log(`${qextStatus}\n`))
)

// Copy Static Directory
const copyStatic$ = extension$.pipe(
  /* Only copy Static if we are bundling with webpack */
  filter(() => program.webpackBuild || program.webpackWatch),
  copyStatic(),
  tap(staticStatus => console.log(`${staticStatus}\n`))
)

// Define Webpack
const webpack$ = extension$.pipe(
  map(extension => defineWebpack(extension)),
  tap(() => console.log(`webpack defined\n`)),
  share(1)
)

// // Build
// const build$ = webpack$.pipe(
//   build({ watch: true })
// )

const build$ = of({ 
  build: program.webpackBuild, 
  watch: program.webpackWatch 
}).pipe(
  mergeMap(buildType => iif(
    /* if bundling with webpack .. */
    () => buildType.build || buildType.watch,

    /* webpack build */
    webpack$.pipe(
      /* watch files if webpack-watch flag set */
      build({ watch: buildType.watch })
    ),

    /* copy source files */
    extension$.pipe(
      copySrc(),
      tap(srcStatus => console.log(`${srcStatus}\n`))
    )
  ))
)


// Distribution Status
const dist$ = combineLatest(copyQext$, copyStatic$, build$, () => 'dist updated')

// Zip
const zip$ = dist$.pipe(
  withLatestFrom(extension$),
  zip(([distStatus, extension]) => extension)
)


// Upload
const upload$ = zip$.pipe(
  filter(() => program.deployServer),
  withLatestFrom(extension$, cookieJar$),
  uploadExtension(([zipStatus, extension, cookie]) => ({
    extension,
    cookie
  })),
  tap(uploadStatus => console.log(`${uploadStatus}\n`))
)

upload$.subscribe()