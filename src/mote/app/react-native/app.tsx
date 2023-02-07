/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React from 'react';
import {SafeAreaView} from 'react-native';
import { WebView } from 'react-native-webview';


function MoteWeb() {
	return (
		<WebView
			style={{flex: 1}}
			source={{uri: 'http://192.168.31.19:8080/'}}
			injectedJavaScriptBeforeContentLoaded={`
				window.onerror = function(message, sourcefile, lineno, colno, error) {
					alert("Message: " + message + " - Source: " + sourcefile + " Line: " + lineno + ":" + colno);
					return true;
				};
				true;
			`}
		/>
	);
}


function App(): JSX.Element {
  return (
	<SafeAreaView style={{flex:1}}>
		<MoteWeb />
	</SafeAreaView>
  );
}

export default App;
