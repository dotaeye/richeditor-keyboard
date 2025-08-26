import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useContext,
} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  BackHandler,
  Platform,
  Image,
  findNodeHandle,
  Animated,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';

import {Navbar} from '../../components';

import {KeyboardInsetsView, getEdgeInsetsForView} from '@sdcx/keyboard-insets';

import {WebView} from 'react-native-webview';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {useSetState} from 'ahooks';
import FontContext from '@/context/FontContext';
import {ViewDriver} from './driver/ViewDriver';
import {Driver} from './driver/Driver';
import {KeyboardDriver} from './driver/KeyboardDriver';
import {SafeAreaView} from 'react-native-safe-area-context';

const commands = {
  BOLD: 'BOLD',
  ITALIC: 'ITALIC',
  UL: 'unordered-list-item',
  OL: 'ordered-list-item',
  BLOCKQUOTE: 'blockquote',
  IMAGE: 'insert-image',
  CAMERA: 'open-camera',
  FONT: 'change-font',
};

const defaultActions = [
  {
    label: 'Bold',
    command: commands.BOLD,
    textIcon: 'format-bold',
    inline: true,
  },
  {
    label: 'Italic',
    command: commands.ITALIC,
    textIcon: 'format-italic',
    inline: true,
  },
  {
    label: 'UL',
    command: commands.UL,
    textIcon: 'format-list-bulleted',
    block: true,
  },
  {
    label: 'OL',
    command: commands.OL,
    textIcon: 'format-list-numbered',
    block: true,
  },
  {
    label: 'BLOCKQUOTE',
    command: commands.BLOCKQUOTE,
    textIcon: 'format-quote-open',
    block: true,
  },
  {
    label: 'IMAGE',
    command: commands.IMAGE,
    textIcon: 'image',
    block: true,
  },
  {
    label: 'CAMERA',
    command: commands.CAMERA,
    textIcon: 'camera',
    block: true,
  },
  {
    label: 'FONT',
    command: commands.FONT,
    textIcon: 'format-font',
    block: true,
    navigation: true,
  },
];

const WriteLetter: React.FC = () => {
  const navigation = useNavigation();
  const {globalFontName, fontData} = useContext(FontContext);

  const injectedScript = `
      window.ENV_RN = true;
      window.__Editor_Fonts = ${JSON.stringify(fontData)};
    `;

  const webviewRef = useRef<WebView | null>(null);
  const [blockState, setBlockState] = useSetState({
    block: '',
    style: [],
  });
  const [showTabbar, setShowTabbar] = useState(false);

  const inputRef = useRef<TextInput>(null); // 输入框
  const senderRef = useRef<View>(null); // 发送框
  const [bottom, setBottom] = useState(0); // 底部距离

  const onLayout = useCallback(() => {
    const viewTag = findNodeHandle(senderRef.current);
    if (viewTag === null) {
      return;
    }

    getEdgeInsetsForView(viewTag, insets => {
      console.log('onLayout', JSON.stringify(insets));
      setBottom(insets.bottom!);
    });
  }, []);

  const emoji = useRef(new ViewDriver('emoji')).current;
  const toolbox = useRef(new ViewDriver('toolbox')).current;
  const keyboard = useRef(
    new KeyboardDriver(inputRef, () => {
      webviewRef.current?.postMessage(
        JSON.stringify({
          messageType: 'richEditor',
          type: 'SHOW_TOOLBAR',
        }),
      );
    }),
  ).current;

  const [driver, setDriver] = useState<Driver>();
  const [translateY, setTranslateY] = useState(new Animated.Value(0));

  const driverState = {bottom, driver, setDriver, setTranslateY};
  console.log('driverState', JSON.stringify(driverState));
  const mainStyle = {
    transform: [
      {
        translateY: translateY,
      },
    ],
  };

  const onMessage = useCallback(
    (event: {nativeEvent: {data?: string}}) => {
      console.log('receive message', event.nativeEvent.data);
      const action = JSON.parse(event.nativeEvent.data || '{}');

      if (action.messageType !== 'richEditor') return;

      if (action.type === 'SHOW_TOOLBAR') {
        if (showTabbar) return;
        setShowTabbar(true);
        console.log('SHOW_TOOLBAR', action);
      } else if (action.type === 'HIDE_TOOLBAR') {
        if (!showTabbar) return;
        setShowTabbar(false);
      } else if (action.type === 'GET_CONTENT') {
        console.log('GET_CONTENT', action);
      } else {
        setBlockState(action);
      }
    },
    [showTabbar],
  );

  const onSendCommand = useCallback((action: any) => {
    if (action.navigation) {
      navigation.navigate('FontList');
      return;
    }
    if (webviewRef.current) {
      console.log('onSendCommand', action);
    }
    webviewRef.current?.postMessage(
      JSON.stringify({
        messageType: 'richEditor',
        type: 'DOCUMENT_COMMAND',
        ...action,
      }),
    );
  }, []);

  const enableFont = useCallback(
    (font: any) => {
      console.log('enableFont-send to webview', font);
      webviewRef.current?.postMessage(
        JSON.stringify({
          messageType: 'richEditor',
          type: 'ENABLE_FONT',
          data: font,
        }),
      );
    },
    [globalFontName],
  );

  useEffect(() => {
    const currentFont = fontData.find(
      item => item.scriptName === globalFontName,
    );
    enableFont(currentFont);
    if (webviewRef.current) {
      webviewRef.current.postMessage(
        JSON.stringify({
          messageType: 'richEditor',
          type: 'SET_CONTENT',
          content: '',
        }),
      );
    }
  }, [globalFontName]);

  const selectItems = [blockState.block, ...blockState.style];

  return (
    <View style={[styles.container]}>
      <KeyboardInsetsView
        onKeyboard={keyboard.createCallback(driverState)}
        style={[
          {
            flex: 1,
          },
          mainStyle,
        ]}>
        <WebView
          ref={webviewRef}
          source={{
            uri: `${
              Platform.OS === 'android' ? 'file:///android_asset/' : ''
            }Web.bundle/index.html`,
          }}
          originWhitelist={['*']}
          webviewDebuggingEnabled
          injectedJavaScriptBeforeContentLoaded={injectedScript}
          injectedJavaScriptObject={fontData}
          hideKeyboardAccessoryView
          onMessage={onMessage}
          style={{
            flex: 1,
          }}
        />

        <View
          style={{
            height: 48,
            width: '100%',
            flexDirection: 'row',
            justifyContent: 'flex-start',
            alignItems: 'center',
            backgroundColor: 'rgb(199,202,209)',
            opacity: showTabbar ? 1 : 0,
          }}
          ref={senderRef}
          onLayout={onLayout}>
          {defaultActions.map((item, index) => {
            return (
              <TouchableOpacity
                key={index}
                onPress={() => {
                  if (item.command === commands.FONT) {
                    emoji.shown ? keyboard.show() : emoji.show(driverState);
                  } else if (item.command === commands.IMAGE) {
                    toolbox.toggle(driverState);
                  } else {
                    onSendCommand(item);
                  }
                }}
                style={{
                  width: 48,
                  height: 48,
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: selectItems.includes(item.command)
                    ? '#eee'
                    : 'rgb(199,202,209)',
                }}>
                <MaterialDesignIcons
                  name={item.textIcon}
                  size={24}
                  color={'#000'}
                />
              </TouchableOpacity>
            );
          })}
        </View>
      </KeyboardInsetsView>
      <SafeAreaView edges={['bottom']} />

      <Animated.View
        style={[styles.absolute, styles.red, emoji.style]}
        onLayout={emoji.onLayout}>
        <View style={styles.emoji}>
          <Text style={styles.text}>表情包</Text>
        </View>
        <SafeAreaView edges={['bottom']} />
      </Animated.View>
      <Animated.View
        style={[styles.absolute, styles.blue, toolbox.style]}
        onLayout={toolbox.onLayout}>
        <View style={styles.toolbox}>
          <Text style={styles.text}>工具箱</Text>
        </View>
        <SafeAreaView edges={['bottom']} />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inverted: {
    transform: [
      {
        scaleY: -1,
      },
    ],
  },
  absolute: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  emoji: {
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  blue: {
    backgroundColor: 'darkkhaki',
  },
  red: {
    backgroundColor: 'cadetblue',
  },
  toolbox: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 48,
    color: 'darkgray',
  },

  navBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navBarButton: {
    padding: 8,
    marginLeft: 8,
  },

  sendTime: {
    fontSize: 12,
    opacity: 0.7,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  editorContainer: {
    flex: 1,
    margin: 16,
    borderRadius: 8,
    padding: 16,
  },
  titleInput: {
    fontSize: 18,
    fontWeight: 'bold',
    paddingVertical: 12,
    borderBottomWidth: 1,
    marginBottom: 16,
  },
  contentInput: {
    fontSize: 16,
    lineHeight: 24,
    minHeight: 200,
    textAlignVertical: 'top',
  },
  wordCount: {
    alignItems: 'flex-end',
    marginTop: 8,
  },
  wordCountText: {
    fontSize: 12,
    opacity: 0.7,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
  },
  toolbarButton: {
    padding: 8,
    marginRight: 16,
  },
  toolbarSpacer: {
    flex: 1,
  },
  draftButton: {
    minWidth: 80,
  },
});

export default WriteLetter;
