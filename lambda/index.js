/**
 * Copyright 2020 Amazon.com, Inc. and its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: LicenseRef-.amazon.com.-AmznSL-1.0
 *
 * Licensed under the Amazon Software License (the "License").
 * You may not use this file except in compliance with the License.
 * A copy of the License is located at
 *
 * http://aws.amazon.com/asl/
 *
 * or in the "license" file accompanying this file. This file is distributed
 * on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 * express or implied. See the License for the specific language governing
 * permissions and limitations under the License.
 **/
'use strict';

const Alexa = require('ask-sdk');
const i18next = require('i18next');
const sprintf = require('sprintf-js').sprintf;
const _ = require('lodash');
const fetch = require('node-fetch');

const resources = require('./resources')
const util = require('./util');

// *****************************************************************************
// Intent handlers
// *****************************************************************************

const CreateAppHandler = {
    canHandle(handlerInput) {
        return (Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'CreateAppIntent')
            || Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    async handle(handlerInput) {
        let attributes = handlerInput.attributesManager.getSessionAttributes();
        console.log('before', attributes);
        let app_name = attributes.app_name;
        console.log('app_name = ', app_name);
        if (handlerInput.requestEnvelope.request.intent.slots.appName.value) {
            attributes.app_name = handlerInput.requestEnvelope.request.intent.slots.appName.value;
        }
        if (handlerInput.requestEnvelope.request.intent.slots.appDescription.value) {
            attributes.description = 'create an app with ' + handlerInput.requestEnvelope.request.intent.slots.appDescription.value;
        }
        console.log('after', attributes);
        handlerInput.attributesManager.setSessionAttributes(attributes);
        if (attributes.description && attributes.app_name) {
            let result = await fetch('https://www.evanpatton.com/alexa/report', {method: 'POST', body: JSON.stringify({name: attributes.app_name, description: attributes.description}), headers: {'Content-Type': 'application/json'}});
            return handlerInput.responseBuilder
                .speak(handlerInput.t('WORKING'))
                .withShouldEndSession(true)
                .getResponse();
        } else if (attributes.app_name) {
            return handlerInput.responseBuilder
                .speak(handlerInput.t('DESCRIBE_APP'))
                .reprompt(handlerInput.t('DESCRIBE_APP'))
                .withShouldEndSession(false)
                .getResponse();
        } else {
            return handlerInput.responseBuilder
                .speak(handlerInput.t('WELCOME'))
                .reprompt(handlerInput.t('NO_NAME_PROMPT'))
                .withShouldEndSession(false)
                .getResponse();
        }
    }
};

// *****************************************************************************
// Launch request handler
// *****************************************************************************
const LaunchHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    async handle(handlerInput) {
        // Our skill is configured to start sessions with the skill's intent handlers, so this is the first handler hit.
        return handlerInput.responseBuilder
            .speak(handlerInput.t('WELCOME'))
            .reprompt(handlerInput.t('NO_NAME_PROMPT'))
            .withShouldEndSession(false)
            .getResponse();
    }
};

/**
 * FallbackIntent triggers when a customer says something that doesn't map to any intents in your skill, while
 * skill is the dialog manager controlling the session (we're not in Alexa Conversations). This handler will also catch
 * requests for the UtteranceTrainingIntent.
 *
 * The UtteranceTrainingIntent contains samples that are the union of Alexa Conversations utterance sets that aren't
 * already contained in the interaction model. This is because the interaction model is the source of truth for training
 * the speech recognition for the skill: if we didn't specify these other utterances, our skill would bias toward
 * recognizing all brief speech as first names, for instance: since AMAZON.FallbackIntent is lower confidence than an
 * "okay" match to a defined interaction model sample utterance, and our skill defines intents dealing with first names.
 * Ultimately, this should be done behind-the-scenes from the Conversations model, but for now, adding the utterances
 * both places ensures good speech recognition.
 *
 * Note: it's expected that this is the last intent handler in the handlers list, so it doesn't preempt more specific
 * intent handlers.
 **/
const FallbackIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest';
    },
    handle(handlerInput) {
        // We expect to handle utterances related to getting the user name: we can use the intent handlers as a loop to
        // get the user to give us one (approximating a "sign in/out" or other separate locking loop function): if we
        // get an utterance outside our skill-handled intents, we can check for a name in the session: if we don't have
        // one, we can prompt for one; if we have one, we can delegate the incoming utterance unchanged to the
        // Conversations handlers.
        const { givenName } = handlerInput.attributesManager.getSessionAttributes();

        if (!givenName) {
            const speechOutput = handlerInput.t('NO_NAME_PROMPT')
            return handlerInput.responseBuilder
                .speak(speechOutput)
                .reprompt(speechOutput)
                .getResponse();
        }

        // We have a givenName, so switch to the Conversations handlers and pass this utterance unchanged to
        // start off. (Since we delegate into Conversations mode as part of handling GiveNameIntent, and only switch
        // back to skill-intent mode when removing the name, this is not likely to see much, if any, traffic.)

        return handlerInput.responseBuilder
            .addDirective({
                'type': 'Dialog.DelegateRequest',
                'target': 'AMAZON.Conversations',
                'period': {
                    'until': 'EXPLICIT_RETURN'
                }
            }).getResponse();
    }
};

const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        // Since this should only be hit while the skill is in the "intent handlers" mode - that is, the user is not
        // 'signed in' - we use a sign-in-related prompt in response to "help" when this intent is hit.
        return handlerInput.responseBuilder
            .speak(handlerInput.t('HELP_INTENT'))
            .reprompt(handlerInput.t('NO_NAME_PROMPT'))
            .getResponse();
    }
};

const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        const speakOutput = handlerInput.t('EXIT');

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .withShouldEndSession(true)
            .getResponse();
    }
};

// *****************************************************************************
// Session ended request handler
// *****************************************************************************

const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        // Add any custom end-of-session clean-up here.
        console.log(`Session ended with reason: ${handlerInput.requestEnvelope.request.reason}`);
        return handlerInput.responseBuilder.getResponse();
    },
};

// *****************************************************************************
// Error handler
// *****************************************************************************

const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.error(`Error handled: ${error.message}`);
        console.error(`Error stack`, JSON.stringify(error.stack));
        console.error(`Error`, JSON.stringify(error));

        return handlerInput.responseBuilder
            .speak(handlerInput.t('ERROR'))
            .reprompt(handlerInput.t('GENERIC_REPROMPT'))
            .getResponse();
    },
};

// *****************************************************************************
// Interceptors
// *****************************************************************************

const LogRequestInterceptor = {
    process(handlerInput) {
        console.log(`REQUEST ENVELOPE = ${JSON.stringify(handlerInput.requestEnvelope)}`);
    },
};

const LogResponseInterceptor = {
    process(handlerInput, response) {
        console.log(`RESPONSE = ${JSON.stringify(response)}`);
    },
};

const LocalizationInterceptor = {
    process(handlerInput) {
        i18next.init({
            lng: _.get(handlerInput, 'requestEnvelope.request.locale'),
            overloadTranslationOptionHandler: sprintf.overloadTranslationOptionHandler,
            resources: resources,
            fallbackLng: 'en',
            returnObjects: true
        });

        handlerInput.t = (key, opts) => {
            const value = i18next.t(key, {...{interpolation: {escapeValue: false}}, ...opts});
            if (Array.isArray(value)) {
                return value[Math.floor(Math.random() * value.length)]; // return a random element from the array
            } else {
                return value;
            }
        };
    }
};

const getTotalCost = (order) => {
    let orderCost = 0;
    if (order.pizzas) {
        orderCost += order.pizzas.map(pizza => pizza.cost)
            .reduce((total, pizzaCost) => total + pizzaCost, 0);
        orderCost = orderCost.toFixed(2);
    }
    return orderCost;
};

// *****************************************************************************
// The SkillBuilder acts as the entry point for your skill, routing all request and response
// payloads to the handlers above. Make sure any new handlers or interceptors you've
// defined are included below. The order matters in lists: they're processed top to bottom.
module.exports.handler = Alexa.SkillBuilders.standard()
    .addRequestHandlers(
        CreateAppHandler,
        SessionEndedRequestHandler)
    .addErrorHandlers(ErrorHandler)
    .addRequestInterceptors(LogRequestInterceptor, LocalizationInterceptor)
    .addResponseInterceptors(LogResponseInterceptor)
    .withCustomUserAgent('reference-skills/app-inventor/v0.1')
    .lambda();