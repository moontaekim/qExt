const should = require("chai").should()
const path = require("path")
const fs = require("fs-extra")
const execQextScripts = require("../../util/exec-qext-scripts")

const testExtensionDir = path.resolve(__dirname, "./TestExtension")
const extensionName = "test-extension"

describe("14. Compile property not set", function() {
	this.timeout(10000)

	it("should fail if compile property is not defined", done => {
		execQextScripts(testExtensionDir, (error, stdout, stderr) => {
			stderr.should.equal(
				`compile property not defined in ./qext.config.json\n`
			)
			done()
		})
	})
})
