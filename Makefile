node_modules:
	npm install

update:
	npm update

build: node_modules
	npm run build

test: node_modules
	npm run test